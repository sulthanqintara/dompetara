import assert from "node:assert/strict";
import { transactionPage } from "../src/features/ledger/pagination.ts";
import { localDate } from "../src/features/ledger/format.ts";
import { periodEntries, spendingHistory } from "../src/features/ledger/derive.ts";
import type { Entry } from "../src/features/ledger/ledger.ts";

const entries = Array.from({ length: 45 }, (_, index) => ({ id: String(index), kind: "expense", date: "2026-09-30T23:30:00Z", amount: 100, wallet: "bank", currency: "IDR", title: "Expense", category: "Food", description: "" } as Entry));
assert.equal(transactionPage(entries, undefined).rows.length, 20);
assert.equal(transactionPage(entries, "2").rows[0].id, "20");
assert.equal(transactionPage(entries, "3").rows.length, 5);
assert.equal(transactionPage(entries, "999").page, 3);
for (const invalid of ["0", "-1", "1.2", "NaN", "1e2", ["2"], "99999999999999999999"]) assert.equal(transactionPage(entries, invalid).page, 1);
assert.equal(transactionPage(entries.slice(0, 20), "3").page, 1);
assert.deepEqual(transactionPage([], "2"), { page: 1, pages: 1, rows: [], total: 0, start: 0, end: 0 });
assert.equal(entries.length, 45);
assert.equal(localDate(new Date(entries[0].date), "Asia/Jakarta"), "2026-10-01T06:30");
assert.equal(localDate(new Date("0001-01-01T00:00:00Z"), "UTC"), "0001-01-01T00:00");
assert.equal(periodEntries({ entries, wallets: [], categories: [] }, { month: "2026-10" }, "Asia/Jakarta").length, 45);
assert.equal(periodEntries({ entries, wallets: [], categories: [] }, { month: "2026-10" }, "UTC").length, 0);
assert.equal(spendingHistory(entries, "IDR", "daily", "Asia/Jakarta")[0].date, "2026-10-01");
console.log("Pagination checks passed: row limits, boundaries, invalid pages, shrinking histories, unchanged data, and explicit timezone dates.");

assert.deepEqual(periodEntries({ entries, wallets: [], categories: [] }, { month: "2026-10" }, "Asia/Jakarta"), periodEntries({ entries: [...entries].reverse(), wallets: [], categories: [] }, { month: "2026-10" }, "Asia/Jakarta"), "Equal timestamps have stable ordering after edits");
