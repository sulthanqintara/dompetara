import assert from "node:assert/strict";
import { displayAmount, parseAmount } from "../src/features/ledger/currency-input.ts";
for (const currency of ["IDR", "USD", "CAD"] as const) {
  for (const value of ["0.00", "10000.25", "999999999999.99", "-10000.50"]) {
    assert.equal(parseAmount(displayAmount(value, currency, true), currency, true), value);
  }
  assert.equal(parseAmount(currency === "IDR" ? "10,001" : "10.001", currency), null);
  assert.equal(parseAmount("-100", currency), null);
}
assert.equal(displayAmount("10000", "IDR"), "10.000");
assert.equal(displayAmount("10000", "IDR", true), "10.000,00");
assert.equal(displayAmount("10000.25", "USD", true), "10,000.25");
assert.equal(parseAmount(",5", "IDR"), "0.5");
assert.equal(parseAmount("-.5", "USD", true), "-0.5");
assert.equal(parseAmount("00010,25", "IDR"), "10.25");
assert.equal(parseAmount("", "IDR"), "");
console.log("Currency input checks passed: grouping, decimals, signed balances, precision, and exact round trips.");

const { printedReceiptTimestamp } = await import("../src/features/receipts/receipt-date.ts");
assert.deepEqual(printedReceiptTimestamp("03.10.26-19:59/4.5.0/TZXN-3517"), {date:"2026-10-03",time:"19:59"});
assert.deepEqual(printedReceiptTimestamp("13.10.2026-09:05"), {date:"2026-10-13",time:"09:05"});
assert.equal(printedReceiptTimestamp("31.02.26-19:59"),null);
assert.equal(printedReceiptTimestamp("03.10.26-19:59 04.10.26-09:00"),null);
assert.equal(printedReceiptTimestamp("Waktu Pembayaran 03.10.26-19:59"),null);
