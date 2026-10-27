import assert from "node:assert/strict";
import type { Pool } from "pg";
import { cutoverLedgers } from "../scripts/ledger-cutover.ts";
import type { Ledger } from "../src/features/ledger/ledger.ts";

const date = "2026-10-05T07:00:00.123+07:00";
const data: Ledger = {
  wallets: [{ id: "bank", name: "Bank", currencies: ["IDR"] }, { id: "cash", name: "Cash", currencies: ["USD"] }],
  categories: [{ id: "Bills", name: "Bills", kind: "expense" }],
  entries: [
    { id: "fee", kind: "expense", date, wallet: "cash", currency: "USD", amount: 2, title: "Transfer service fee", category: "Admin fees", description: "", transferId: "transfer" },
    { id: "transfer", kind: "transfer", date, wallet: "bank", currency: "IDR", amount: 100, title: "Transfer", category: "", description: "", toWallet: "cash", toCurrency: "USD", received: 50, exchangeRate: { value: "0.5", source: "manual" } },
    { id: "receipt", kind: "expense", date, wallet: "bank", currency: "IDR", amount: 10, title: "Receipt", category: "Bills", description: "", receipt: { importId: "00000000-0000-4000-8000-000000000001", fingerprint: "a".repeat(64), method: "ai", documentKind: "receipt", merchant: null, receiptNumber: null, keepItems: false, items: [], adjustments: [] } },
  ],
  receiptImports: [{ importId: "00000000-0000-4000-8000-000000000001", fingerprint: "a".repeat(64), entryId: "receipt" }],
};
const original = structuredClone(data);
type Row = Record<string, unknown>;

// A recording SQL client exercises the real serialization/read-back without a database.
function fixture(options: { failOn?: string; corruptReadBack?: boolean; invalidSource?: boolean } = {}) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const tables: Record<string, Row[]> = {};
  let released = false;
  const client = {
    release() { released = true; },
    async query(sql: string, values: unknown[] = []) {
      queries.push({ sql, values });
      if (options.failOn && sql.startsWith(options.failOn)) throw new Error("Injected database failure");
      if (sql.startsWith("SELECT user_id, data")) {
        const rows = [{ user_id: "user", data: options.invalidSource ? {} : data }];
        return { rows: values[0] ? rows.filter((row) => row.user_id === values[0]) : rows };
      }
      const insert = sql.match(/^INSERT INTO public\.(\w+) \(([^)]+)\)/);
      if (insert) {
        const row = Object.fromEntries(insert[2].split(",").map((column, index) => [column, values[index]]));
        if (row.transfer_id) assert.ok(tables.ledger_transactions.some((parent) => parent.id === row.transfer_id), "Insert the parent transfer before its fee");
        (tables[insert[1]] ??= []).push(row);
      }
      const select = sql.match(/^SELECT (.+) FROM public\.(\w+) WHERE user_id/);
      if (!select) return { rows: [] };
      const aliases = [...select[1].matchAll(/(\w+) AS "(\w+)"/g)];
      const rows = (tables[select[2]] ?? []).filter((row) => row.user_id === values[0])
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((row) => Object.fromEntries(aliases.map(([, column, alias]) => {
          let value = row[column];
          if (value !== null) {
            if (["receipt", "details", "exchange_rate"].includes(column)) value = JSON.parse(value as string);
            else if (["amount_minor", "received_minor"].includes(column)) value = String(value);
          }
          return [alias, value];
        })));
      if (options.corruptReadBack && select[2] === "ledger_transactions") rows[0].title = "Corrupted";
      return { rows };
    },
  };
  return { pool: { connect: async () => client } as unknown as Pool, queries, tables, released: () => released };
}

const dry = fixture();
assert.deepEqual(await cutoverLedgers(dry.pool), { ledgers: 1, entries: 3, applied: false });
assert.equal(dry.queries[0].sql, "BEGIN ISOLATION LEVEL REPEATABLE READ");
assert.equal(dry.queries.at(-1)?.sql, "ROLLBACK");
assert.ok(dry.queries.every(({ sql }) => !/^(INSERT|UPDATE|LOCK|COMMIT)/.test(sql)));
assert.deepEqual(dry.queries.find(({ sql }) => sql.startsWith("SELECT user_id"))?.values, [null]);
assert.ok(dry.released());

const applied = fixture();
assert.deepEqual(await cutoverLedgers(applied.pool, true, "user"), { ledgers: 1, entries: 3, applied: true });
assert.equal(applied.queries[1].sql, "LOCK TABLE public.ledger IN SHARE ROW EXCLUSIVE MODE");
assert.deepEqual(applied.queries.find(({ sql }) => sql.startsWith("SELECT user_id"))?.values, ["user"]);
assert.deepEqual(applied.tables.ledger_transactions.map((row) => row.id), ["transfer", "receipt", "fee"]);
assert.equal(applied.tables.ledger_transactions[0].original_date, date);
assert.deepEqual(applied.tables.ledger_wallets[0].currencies, data.wallets[0].currencies, "Postgres arrays stay arrays");
assert.equal(typeof applied.tables.ledger_transactions[1].receipt, "string", "JSON columns are serialized");
assert.equal(applied.tables.ledger_receipt_imports[0].entry_id, "receipt");
assert.equal(applied.tables.ledger_categories.find((row) => row.name === "Admin fees")?.archived, true);
assert.ok(applied.queries.at(-2)?.sql.startsWith("UPDATE public.ledger SET normalized"));
assert.equal(applied.queries.at(-1)?.sql, "COMMIT");
assert.ok(applied.released());

const empty = fixture();
assert.deepEqual(await cutoverLedgers(empty.pool, true, "other-user"), { ledgers: 0, entries: 0, applied: true });
assert.equal(empty.queries.at(-1)?.sql, "COMMIT");
assert.ok(empty.released());

for (const options of [
  { failOn: "INSERT INTO" }, { failOn: "SELECT user_id AS" }, { failOn: "UPDATE public.ledger" },
  { corruptReadBack: true }, { invalidSource: true },
]) {
  const failed = fixture(options);
  await assert.rejects(cutoverLedgers(failed.pool, true));
  assert.equal(failed.queries.at(-1)?.sql, "ROLLBACK");
  assert.ok(failed.queries.every(({ sql }) => sql !== "COMMIT"));
  if (!options.failOn?.startsWith("UPDATE")) assert.ok(failed.queries.every(({ sql }) => !sql.startsWith("UPDATE")), "Mark normalized only after successful verification");
  assert.ok(failed.released());
}
assert.deepEqual(data, original, "Cutover preserves the source ledger");
console.log("Cutover checks passed: dry run, transaction/lock boundaries, scoped reads, transfer ordering, JSON/arrays, read-back integrity, rollback and client release.");
