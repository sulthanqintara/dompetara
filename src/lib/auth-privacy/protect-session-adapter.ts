import type { DBAdapter, DBAdapterInstance, DBTransactionAdapter } from "better-auth";
import { z } from "zod";
import { createSessionTokenCodec } from "./create-session-token-codec.ts";

const operations = new Set([
  "create", "findOne", "findMany", "count", "update", "updateMany",
  "delete", "deleteMany", "consumeOne", "incrementOne",
]);

// Encryption retains Better Auth's session listing/revocation semantics; a
// separate SHA-256 index supports lookup without deterministic encryption.
export function protectSessionAdapter(factory: DBAdapterInstance): DBAdapterInstance {
  return (options) => {
    const codec = createSessionTokenCodec(options.secret ?? process.env.BETTER_AUTH_SECRET);

    async function encode(data: Record<string, unknown>) {
      if (data.token === undefined) return data;
      const token = z.string().min(1).parse(data.token);
      return { ...data, token: await codec.encrypt(token), tokenHash: codec.hash(token) };
    }

    async function decode(value: unknown, session = false): Promise<unknown> {
      if (Array.isArray(value)) return Promise.all(value.map((row) => decode(row, session)));
      if (!value || typeof value !== "object") return value;
      const row = { ...value } as Record<string, unknown>;
      if (session && typeof row.token === "string") {
        row.token = await codec.decrypt(row.token);
      }
      delete row.tokenHash;
      for (const field of ["session", "sessions"]) {
        if (row[field] !== undefined) row[field] = await decode(row[field], true);
      }
      return row;
    }

    function wrap<T extends DBTransactionAdapter>(adapter: T): T {
      return new Proxy(adapter, {
        get(target, property, receiver) {
          const original = Reflect.get(target, property, receiver);
          if (property === "transaction" && typeof original === "function") {
            return (callback: (transaction: DBTransactionAdapter) => Promise<unknown>) =>
              original.call(target, (transaction: DBTransactionAdapter) => callback(wrap(transaction)));
          }
          if (typeof property !== "string" || !operations.has(property) || typeof original !== "function") return original;
          return async (input: Record<string, unknown>) => {
            const args = { ...input };
            const isSession = args.model === "session";
            if (isSession) {
              if (Array.isArray(args.where)) args.where = args.where.map((condition) => {
                if (condition.field !== "token") return condition;
                const operator = condition.operator ?? "eq";
                if (!["eq", "ne", "in", "not_in"].includes(operator)) throw new Error("Unsupported session token comparison.");
                return { ...condition, field: "tokenHash", value: Array.isArray(condition.value)
                  ? condition.value.map((token: unknown) => codec.hash(z.string().parse(token)))
                  : codec.hash(z.string().parse(condition.value)) };
              });
              for (const field of ["data", "update", "set"]) {
                if (args[field] && typeof args[field] === "object") args[field] = await encode(args[field] as Record<string, unknown>);
              }
            }
            return decode(await original.call(target, args), isSession);
          };
        },
      });
    }
    return wrap(factory(options)) as DBAdapter;
  };
}
