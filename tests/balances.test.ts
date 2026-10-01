import assert from "node:assert/strict";
import { balanceBreakdown } from "../src/features/ledger/balances.ts";
import { convertBalanceMinor, crossRate, type RateSuggestion } from "../src/features/exchange-rates/exchange-rates.ts";
import { currencies, type Ledger } from "../src/features/ledger/ledger.ts";

const data: Ledger = {
  wallets: [{ id: "bank", name: "Bank", currencies: [...currencies] }, { id: "cash", name: "Cash", currencies: ["IDR"] }], categories: [],
  entries: ([
    { id: "idr", wallet: "bank", currency: "IDR", amount: 10000000 },
    { id: "cash", wallet: "cash", currency: "IDR", amount: 5000000 },
    { id: "usd", wallet: "bank", currency: "USD", amount: 10000 },
    { id: "cad", wallet: "bank", currency: "CAD", amount: 13800 },
  ] as const).map((entry) => ({ ...entry, kind: "correction", date: "2026-01-01T00:00:00Z", title: "Opening", category: "", description: "" })),
};
const snapshot = { IDR: "17800", CAD: "1.38" };
const rates = Object.fromEntries(currencies.map((currency) => [currency, { rate: crossRate(snapshot, currency, "IDR"), rateDate: "2026-10-01", provider: "ecb", lastCheckedAt: "2026-10-01T00:00:00Z", stale: false }])) as Record<typeof currencies[number], RateSuggestion>;
const result = balanceBreakdown(data, "IDR", rates);
assert.equal(result.total, 371000000);
assert.deepEqual(result.rows.map((row) => [row.currency, row.amount, row.converted]), [["IDR", 15000000, 15000000], ["USD", 10000, 178000000], ["CAD", 13800, 178000000]]);
for (const target of currencies) {
  const suggestions = Object.fromEntries(currencies.map((source) => [source, { ...rates[source], rate: crossRate(snapshot, source, target) }]));
  const converted = balanceBreakdown(data, target, suggestions);
  assert.equal(converted.total, converted.rows.reduce((sum, row) => sum + row.converted!, 0));
  assert.equal(converted.rows.find((row) => row.currency === target)!.converted, converted.rows.find((row) => row.currency === target)!.amount);
}
assert.equal(balanceBreakdown(data, "IDR", {}).total, null);
assert.equal(balanceBreakdown(data, "IDR", { ...rates, CAD: { ...rates.CAD, rateDate: "2026-09-30" } }).total, null);
assert.equal(balanceBreakdown(data, "IDR", { ...rates, USD: { ...rates.USD, stale: true } }).stale, true);
assert.equal(balanceBreakdown({ ...data, entries: [] }, "IDR", {}).total, 0);
assert.equal(convertBalanceMinor(-10000, "17800"), -178000000);
assert.equal(convertBalanceMinor(-1, "0.5"), -1);
assert.equal(convertBalanceMinor(-1, "0.00001"), 0);
assert.equal(convertBalanceMinor(0, "17800"), 0);
assert.throws(() => convertBalanceMinor(Number.MAX_SAFE_INTEGER, "17800"));
assert.equal(balanceBreakdown(data, "IDR", { ...rates, CAD: { ...rates.CAD, rate: "0" } }).total, null);
assert.deepEqual(data.entries.map((entry) => entry.amount), [10000000, 5000000, 10000, 13800]);
console.log("Balance checks passed: native totals, all target currencies, signed exact rounding, zero balances, missing/stale/mismatched rates, overflow, and unchanged ledger data.");
