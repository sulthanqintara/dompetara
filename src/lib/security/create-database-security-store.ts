import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { SecurityLimitStore } from "./security-limits.ts";

export type SecurityDatabase = { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> };

export function createDatabaseSecurityStore(database: SecurityDatabase, schema = "public"): SecurityLimitStore {
  // The schema is supplied by isolated database tests, never by an HTTP request.
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error("Invalid security schema.");
  return {
    async consume(request) {
      const result = await database.execute(sql`select * from ${sql.identifier(schema)}.consume_security_limits(${JSON.stringify(request)}::jsonb)`);
      const row = result.rows[0];
      if (typeof row?.allowed !== "boolean" || !Number.isSafeInteger(row.retry_after_seconds) || Number(row.retry_after_seconds) < 0)
        throw new Error("Security limiter response is unavailable.");
      return { allowed: row.allowed, retryAfterSeconds: Number(row.retry_after_seconds) };
    },
    async release(token) {
      await database.execute(sql`delete from ${sql.identifier(schema)}.security_admission_leases where token = ${token}`);
    },
  };
}
