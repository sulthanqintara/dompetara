import assert from "node:assert/strict";
import { format, localDate, splitCurrencyAmount } from "../src/features/ledger/format.ts";

for (const currency of ["IDR", "USD", "CAD"] as const) {
  assert.equal(splitCurrencyAmount(format(0, currency), currency).amount, "0", "Zero formatting has explicit decimal rules");
  assert.equal(splitCurrencyAmount(format(12345, currency), currency).amount, "123.45");
  assert.equal(splitCurrencyAmount(format(12340, currency), currency).amount, "123.4");
  assert.equal(splitCurrencyAmount(format(12300, currency), currency).amount, "123");
  assert.equal(splitCurrencyAmount(format(123456789, currency), currency).amount, "1,234,567.89");
  assert.equal(splitCurrencyAmount(format(100, currency), currency, "code").prefix.trim(), currency);
}
assert.equal(localDate(new Date("2026-10-07T17:00:00Z"), "Asia/Jakarta"), "2026-10-08T00:00");
assert.equal(localDate(new Date("2026-10-07T17:00:00Z"), "UTC"), "2026-10-07T17:00");
assert.equal(localDate(new Date("2026-10-07T17:01:00Z"), "Asia/Jakarta"), "2026-10-08T00:01");
console.log("Amount formatting and timezone checks passed.");
