import assert from "node:assert/strict";
import { periodEntries, periodRange, periodTotals, spendByCategory, spendingHistory, validPeriod } from "../src/features/ledger/derive.ts";
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

assert.deepEqual(spendingHistory(entries, "IDR", "daily"), [
  { date: "2026-01-31", amount: 100 },
  { date: "2026-02-01", amount: 250 },
]);
assert.deepEqual(spendingHistory(data.entries, "IDR", "monthly"), [
  { date: "2026-01", amount: 600 },
  { date: "2026-02", amount: 750 },
]);
assert.deepEqual(spendingHistory(entries, "USD", "daily"), [{ date: "2026-02-01", amount: 999 }]);
assert.deepEqual(spendingHistory([], "IDR", "daily"), []);
console.log("Spending history checks passed: daily/monthly grouping, sorting, currency isolation, fees, and exact totals.");

// Fixed UTC instants exercise actual device-timezone boundaries independently
// of the local-date fixtures above.
const originalTimezone = process.env.TZ;
try {
  const midnightData = emptyLedger();
  midnightData.entries = [entry("midnight", "2026-01-31T17:00:00Z", "expense", "IDR", 123)];
  for (const [timezone, expectedDay] of [
    ["UTC", "2026-01-31"],
    ["Asia/Jakarta", "2026-02-01"],
    ["America/New_York", "2026-01-31"],
  ]) {
    process.env.TZ = timezone;
    assert.deepEqual(spendingHistory(midnightData.entries, "IDR", "daily"), [{ date: expectedDay, amount: 123 }]);
    assert.equal(periodEntries(midnightData, { start: expectedDay, end: expectedDay }).length, 1);
    assert.equal(periodEntries(midnightData, { month: expectedDay.slice(0, 7) }).length, 1);
    assert.equal(periodRange({ month: "0001-02" }).end, "0001-02-28");
    assert.equal(periodRange({ month: "9999-12" }).end, "9999-12-31");
  }
  process.env.TZ = "America/New_York";
  for (const [day, instants] of [
    ["2026-03-08", ["2026-03-08T04:59:59Z", "2026-03-08T05:00:00Z", "2026-03-09T03:59:59Z", "2026-03-09T04:00:00Z"]],
    ["2026-11-01", ["2026-11-01T03:59:59Z", "2026-11-01T04:00:00Z", "2026-11-02T04:59:59Z", "2026-11-02T05:00:00Z"]],
  ] as const) {
    const dstData = emptyLedger();
    dstData.entries = instants.map((instant, index) => entry(String(index), instant, "expense", "IDR", 100));
    const included = periodEntries(dstData, { start: day, end: day });
    assert.deepEqual(included.map((e) => e.id), ["2", "1"]);
    assert.deepEqual(spendingHistory(included, "IDR", "daily"), [{ date: day, amount: 200 }]);
  }
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}
console.log("Timezone checks passed: UTC/Jakarta/New York midnight, year limits, and 23/25-hour DST days.");
