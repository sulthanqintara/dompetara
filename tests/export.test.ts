import assert from "node:assert/strict";
import { ledgerExport } from "../src/features/ledger/export.ts";
import { emptyLedger, type Entry } from "../src/features/ledger/ledger.ts";

const data = emptyLedger();
data.wallets = [
  { id: "bank", name: 'Bank, "main"', currencies: ["CAD", "IDR"] },
  { id: "cash", name: "=SUM(1,2)", currencies: ["IDR"] },
];
const base: Entry = {
  id: "expense", kind: "expense", date: "2026-01-31T17:00:00.000Z",
  wallet: "bank", currency: "CAD", amount: 29, title: '=HYPERLINK("bad")',
  category: 'Food, "drink"', description: "Line one\nLine two",
};
data.entries = [
  base,
  { ...base, id: "transfer", kind: "transfer", amount: 15933, toWallet: "cash", toCurrency: "IDR", received: 200000000,
    exchangeRate: { value: "12552.563861168644", source: "received" } },
  { ...base, id: "fee", amount: 100, transferId: "transfer", category: "Admin fees" },
  { ...base, id: "correction", kind: "correction", amount: -99999999999999 },
];
const original = structuredClone(data);
const now = new Date("2026-10-01T12:00:00.000Z");
const json = ledgerExport({ data, version: 42 }, "json", now);
assert.deepEqual(JSON.parse(json.content), {
  format: "personal-ledger", schemaVersion: 1, exportedAt: now.toISOString(), ledgerVersion: 42, data,
});
assert.equal(json.filename, "personal-ledger-2026-10-01T12-00-00-000Z.json");
assert.match(json.mimeType, /application\/json/);
const csv = ledgerExport({ data, version: 42 }, "csv", now);
assert.ok(csv.content.startsWith('\uFEFF"id","kind","date_utc"'));
assert.ok(csv.content.includes('"Bank, ""main"""'));
assert.ok(csv.content.includes('"\'=SUM(1,2)"'));
assert.ok(csv.content.includes('"\'=HYPERLINK(""bad"")"'));
assert.ok(csv.content.includes('"Line one\nLine two"'));
assert.ok(csv.content.includes('"0.29","29"'));
assert.ok(csv.content.includes('"159.33","15933"'));
assert.ok(csv.content.includes('"2000000","200000000"'));
assert.ok(csv.content.includes('"12552.563861168644","received"'));
assert.ok(csv.content.includes('"-999999999999.99","-99999999999999"'));
assert.deepEqual(data, original, "Exports must not change ledger data");
for (const title of ["+SUM(1,2)", "-SUM(1,2)", "@SUM(1,2)", "  =SUM(1,2)", "\tformula"]) {
  const content = ledgerExport({ data: { ...data, entries: [{ ...base, title }] }, version: 0 }, "csv", now).content;
  assert.ok(content.includes(`"'${title}"`));
}
const empty = ledgerExport({ data: emptyLedger(), version: 0 }, "csv", now);
assert.equal(empty.content.split("\r\n").length, 2, "Empty ledger exports headers only");
console.log("Export checks passed: complete JSON, exact money, transfer/rate/fee preservation, quoted multiline CSV, formula neutralization, and empty ledgers.");
