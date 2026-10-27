import assert from "node:assert/strict";
import { loadTypescriptModule } from "./support/load-typescript-module.ts";
import * as orm from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { emptyLedger, mutateLedger } from "../src/features/ledger/ledger.ts";
import { ledgerFromRows, ledgerStorageRows } from "../src/features/ledger/storage.ts";
import { planLedgerChanges } from "../src/features/ledger/write-plan.ts";
import type { writeLedgerChanges } from "../src/features/ledger/server/write-ledger-changes";
import type { LedgerDatabase } from "../src/features/ledger/server/database";

const schema: Record<string, pg.AnyPgTable> = {};
const writer: { writeLedgerChanges?: typeof writeLedgerChanges } = {};
const dependencies: Record<string, unknown> = {
  "server-only": {}, "drizzle-orm": orm, "drizzle-orm/pg-core": pg,
  "./auth": { user: pg.pgTable("user", { id: pg.text("id") }) },
  "@/lib/db/schema": schema, "../storage": { ledgerFromRows }, "../write-plan": { planLedgerChanges },
};
for (const [path, exports] of [["src/lib/db/schema/ledger.ts", schema], ["src/features/ledger/server/write-ledger-changes.ts", writer]] as const) {
  await loadTypescriptModule(path, dependencies, exports);
}
let previous = mutateLedger(emptyLedger(), { action: "wallet", name: "Bank", currency: "IDR", amount: "1000" });
previous = mutateLedger(previous, { action: "wallet", name: "Cash", currency: "USD", amount: "0" });
const [bank, cash] = previous.wallets;
const base = { action: "entry", kind: "expense", date: "2026-10-01T00:00:00Z", wallet: bank.id, currency: "IDR", amount: "10", title: "Lunch", category: "Food & drink", description: "" };
previous = mutateLedger(previous, base);
const transfer = { ...base, kind: "transfer", toWallet: cash.id, toCurrency: "USD", received: "5", feeAmount: "0.1", feeChargedTo: "destination" };
previous = mutateLedger(previous, transfer);
const stored = ledgerStorageRows("user", previous);
previous = ledgerFromRows(stored.wallets, stored.categories, stored.entries, stored.imports);
const oldTransfer = previous.entries.find((entry) => entry.kind === "transfer")!;
let next = mutateLedger(previous, { action: "deleteEntry", id: oldTransfer.id });
const category = previous.categories.find((category) => category.name === base.category)!;
next = mutateLedger(next, { action: "deleteCategory", id: category.id });
next = mutateLedger(next, { action: "category", name: category.name, kind: "expense" });
next = mutateLedger(next, transfer);
const receipt = { importId: "00000000-0000-4000-8000-000000000001", fingerprint: "a".repeat(64), method: "ai", documentKind: "receipt", merchant: null, receiptNumber: null, keepItems: false, items: [], adjustments: [] };
next = mutateLedger(next, { ...base, action: "receipt", receipt });
const context = { categories: stored.categories, positions: stored.entries.map(({ id, position }) => ({ id, position })), nextPosition: 50, nextImportPosition: 10 };
const events: { operation: string; table: string; row?: Record<string, unknown>; query?: { sql: string; params: unknown[] } }[] = [];
const dialect = new pg.PgDialect();
const database = {
  select: () => ({ from: (table: pg.AnyPgTable) => ({ where: (condition: orm.SQL) => {
    events.push({ operation: "select", table: orm.getTableName(table), query: dialect.sqlToQuery(condition) });
    return Promise.resolve([]);
  } }) }),
  delete: (table: pg.AnyPgTable) => ({ where: async (condition: orm.SQL) => {
    events.push({ operation: "delete", table: orm.getTableName(table), query: dialect.sqlToQuery(condition) });
  } }),
  update: (table: pg.AnyPgTable) => ({ set: (row: Record<string, unknown>) => ({ where: async (condition: orm.SQL) => {
    events.push({ operation: "archive", table: orm.getTableName(table), row, query: dialect.sqlToQuery(condition) });
  } }) }),
  insert: (table: pg.AnyPgTable) => ({ values: (row: Record<string, unknown>) => {
    events.push({ operation: "insert", table: orm.getTableName(table), row });
    return { onConflictDoUpdate: async () => {} };
  } }),
  execute: async (query: orm.SQL) => { events.push({ operation: "execute", table: "ledger_transactions", query: dialect.sqlToQuery(query) }); },
} as unknown as LedgerDatabase;
const result = await writer.writeLedgerChanges!(database, "user", previous, next, context);
assert.equal(events[0].operation, "delete", "Remove old transfers and fees before inserting replacements");
assert.ok(events[0].query?.params.includes(oldTransfer.id));
const archiveIndex = events.findIndex((event) => event.operation === "archive");
const replacement = next.categories.find((candidate) => candidate.name === category.name)!;
const replacementIndex = events.findIndex((event) => event.operation === "insert" && event.table === "ledger_categories" && event.row?.id === replacement.id);
assert.ok(archiveIndex >= 0 && replacementIndex > archiveIndex, "Archive before reusing an active category name");
const transactions = events.filter((event) => event.operation === "insert" && event.table === "ledger_transactions");
const parentIndex = transactions.findIndex((event) => event.row?.kind === "transfer");
const feeIndex = transactions.findIndex((event) => event.row?.transferId === transactions[parentIndex].row?.id);
assert.ok(parentIndex >= 0 && feeIndex > parentIndex, "Write the transfer before its linked fee");
assert.ok(events.findIndex((event) => event.table === "ledger_receipt_imports") > events.findLastIndex((event) => event.table === "ledger_transactions"));
for (const event of events) {
  if (event.row?.userId) assert.equal(event.row.userId, "user");
  if (event.query) assert.ok(event.query.params.includes("user"), "Scope every SQL operation to the authenticated user");
}
assert.equal(result.nextPosition, 53);
assert.equal(result.invalidateTransactions, true);
assert.deepEqual(result.after.entries.map((entry) => entry.id), next.entries.map((entry) => entry.id));

events.length = 0;
await writer.writeLedgerChanges!(database, "user", previous, previous, context);
assert.equal(events.length, 0, "An unchanged ledger performs no writes");
await writer.writeLedgerChanges!(database, "user", { wallets: [], categories: [], entries: [] }, emptyLedger());
assert.equal(events.filter((event) => event.operation === "select").length, 2, "Initialization without context reads category and position history");
console.log("Ledger writer checks passed: actual schema/SQL, user scoping, delete/archive/parent/import ordering, no-op writes and initialization fallback.");
