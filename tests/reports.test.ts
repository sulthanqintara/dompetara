import assert from "node:assert/strict";
import { periodEntries, periodRange, periodTotals, spendByCategory, validPeriod } from "../src/features/ledger/derive.ts";
import { emptyLedger, type Entry } from "../src/features/ledger/ledger.ts";

const data = emptyLedger();
const entry = (id: string, date: string, kind: Entry["kind"], currency: Entry["currency"], amount: number): Entry => ({
  id, date: new Date(date).toISOString(), kind, currency, amount,
  wallet: "bank", title: id, category: "Food", description: "",
});
data.entries = [
  entry("before", "2026-01-30T23:59:59", "expense", "IDR", 500),
  entry("start", "2026-01-31T00:00:00", "expense", "IDR", 100),
  entry("end", "2026-02-01T23:59:59", "expense", "IDR", 200),
  entry("after", "2026-02-02T00:00:00", "expense", "IDR", 500),
  entry("income", "2026-02-01T12:00:00", "income", "IDR", 1000),
  entry("usd", "2026-02-01T12:00:00", "expense", "USD", 999),
  entry("transfer", "2026-02-01T12:00:00", "transfer", "IDR", 9000),
  entry("opening", "2026-02-01T12:00:00", "correction", "IDR", 8000),
  { ...entry("fee", "2026-02-01T12:00:00", "expense", "IDR", 50), transferId: "transfer", category: "Admin fees" },
];
const entries = periodEntries(data, { start: "2026-01-31", end: "2026-02-01" });
assert.equal(entries.length, 7);
assert.deepEqual(periodTotals(entries, "IDR"), { income: 1000, expense: 350 });
assert.deepEqual(spendByCategory(entries, "IDR"), [["Food", 300], ["Admin fees", 50]]);
assert.deepEqual(periodTotals(entries, "USD"), { income: 0, expense: 999 });
assert.equal(periodEntries(data, { month: "2026-01" }).length, 2);
assert.equal(periodEntries(data, { start: "2026-02-01", end: "2026-02-01" }).length, 6);
assert.deepEqual(periodTotals(periodEntries(data, { month: "1999-01" }), "IDR"), { income: 0, expense: 0 });
assert.deepEqual(periodRange({ month: "2024-02" }), { start: "2024-02-01", end: "2024-02-29" });
assert.equal(periodRange({ month: "2026-02" }).end, "2026-02-28");
assert.equal(periodRange({ month: "2026-12" }).end, "2026-12-31");
for (const [start, end] of [["2026-02-30", "2026-03-01"], ["", "2026-03-01"], ["2026-03-02", "2026-03-01"]]) {
  assert.equal(validPeriod(start, end), false);
  assert.deepEqual(periodEntries(data, { start, end }), []);
}
console.log(`Report checks passed (${process.env.TZ ?? "device timezone"}): inclusive dates, month boundaries, leap years, currencies, fees, and excluded balance movements.`);
