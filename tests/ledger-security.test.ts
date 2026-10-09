import assert from "node:assert/strict";
import { balance, emptyLedger, ledgerBalances, mutateLedger, type Entry, type Ledger } from "../src/features/ledger/ledger.ts";
import { assertLedgerLimits, ledgerBytes, LEDGER_LIMITS } from "../src/features/ledger/ledger-limits.ts";

const entry = (id: string, extra: Partial<Entry> = {}): Entry => ({
  id, kind: "income", date: "2026-10-09T00:00:00.000Z", wallet: "bank", currency: "IDR",
  amount: 100, title: "Ledger", category: "Salary", description: "", ...extra,
});
const ledger = (): Ledger => ({
  ...emptyLedger(),
  wallets: [{ id: "bank", name: "Bank", currencies: ["IDR", "USD"] }, { id: "cash", name: "Cash", currencies: ["IDR"] }],
});
const income = {
  action: "entry", kind: "income", date: "2026-10-09T00:00:00.000Z", wallet: "bank",
  currency: "IDR", amount: "1", title: "Ledger", category: "Salary", description: "",
};

const walletFull = ledger();
walletFull.wallets = Array.from({ length: LEDGER_LIMITS.wallets }, (_, index) => ({ id: `wallet-${index}`, name: "Bank", currencies: ["IDR"] }));
assert.throws(() => mutateLedger(walletFull, { action: "wallet", name: "New", currency: "IDR", amount: "0" }), /Wallet limit/);
const walletLegacy = { ...walletFull, wallets: [...walletFull.wallets, { id: "legacy", name: "Bank", currencies: ["IDR"] as const }] } as Ledger;
assert.equal(mutateLedger(walletLegacy, { action: "deleteWallet", id: "legacy" }).wallets.length, LEDGER_LIMITS.wallets);
assert.equal(mutateLedger(walletLegacy, { action: "wallet", id: "legacy", name: "Renamed", currency: "IDR", amount: "0" }).wallets.length, LEDGER_LIMITS.wallets + 1);
assert.throws(() => mutateLedger(walletLegacy, { action: "wallet", name: "Another", currency: "IDR", amount: "0" }), /Wallet limit/);

const categoryFull = ledger();
categoryFull.categories = Array.from({ length: LEDGER_LIMITS.categories }, (_, index) => ({ id: `category-${index}`, name: index ? `Category ${index}` : "Salary", kind: "income" }));
assert.throws(() => mutateLedger(categoryFull, { action: "category", name: "New", kind: "income" }), /Category limit/);
assert.throws(() => mutateLedger(categoryFull, { ...income, category: "New", newCategory: true }), /Category limit/);
assert.equal(mutateLedger(categoryFull, { ...income, category: "salary", newCategory: true }).categories.length, LEDGER_LIMITS.categories);
const categoryLegacy = { ...categoryFull, categories: [...categoryFull.categories, { id: "legacy", name: "Legacy", kind: "income" as const }] };
assert.equal(mutateLedger(categoryLegacy, { action: "deleteCategory", id: "legacy" }).categories.length, LEDGER_LIMITS.categories);
assert.equal(mutateLedger(categoryLegacy, income).categories.length, LEDGER_LIMITS.categories + 1);

const entriesFull = ledger();
entriesFull.entries = Array.from({ length: LEDGER_LIMITS.entries }, (_, index) => entry(`entry-${index}`));
const unchanged = structuredClone(entriesFull);
assert.throws(() => mutateLedger(entriesFull, income), /Transaction limit/);
assert.equal(mutateLedger(entriesFull, { ...income, id: "entry-0", title: "Edited" }).entries.length, LEDGER_LIMITS.entries);
assert.equal(mutateLedger(entriesFull, { action: "deleteEntry", id: "entry-0" }).entries.length, LEDGER_LIMITS.entries - 1);
assert.deepEqual(entriesFull, unchanged, "Rejected and successful mutations do not change saved input");
const entriesLegacy = { ...entriesFull, entries: [...entriesFull.entries, entry("legacy")] };
assert.equal(mutateLedger(entriesLegacy, { ...income, id: "legacy" }).entries.length, LEDGER_LIMITS.entries + 1);
assert.equal(mutateLedger(entriesLegacy, { action: "deleteEntry", id: "legacy" }).entries.length, LEDGER_LIMITS.entries);
assert.throws(() => mutateLedger(entriesLegacy, income), /Transaction limit/);

const feeTransfer = { ...income, kind: "transfer", toWallet: "cash", toCurrency: "IDR", amount: "10", feeAmount: "1", feeChargedTo: "source" };
const oneSlot = { ...entriesFull, entries: entriesFull.entries.slice(1) };
assert.throws(() => mutateLedger(oneSlot, feeTransfer), /Transaction limit/, "Linked fee counts as another stored transaction");
const twoSlots = { ...entriesFull, entries: entriesFull.entries.slice(2) };
assert.equal(mutateLedger(twoSlots, feeTransfer).entries.length, LEDGER_LIMITS.entries);

const receipt = {
  importId: crypto.randomUUID(), fingerprint: "a".repeat(64), method: "ai", documentKind: "receipt",
  merchant: null, receiptNumber: null, keepItems: false, paymentConfirmed: false, items: [], adjustments: [],
};
const importsFull = ledger();
importsFull.receiptImports = Array.from({ length: LEDGER_LIMITS.receiptImports }, (_, index) => ({ importId: `old-${index}`, fingerprint: String(index).padStart(64, "0"), entryId: `entry-${index}` }));
assert.throws(() => mutateLedger(importsFull, { ...income, action: "receipt", kind: "expense", category: "Food & drink", receipt }), /Receipt import limit/);
importsFull.receiptImports[0] = { importId: receipt.importId, fingerprint: receipt.fingerprint, entryId: "deleted-entry" };
assert.deepEqual(mutateLedger(importsFull, { action: "receipt", receipt }), importsFull, "Durable receipt retry stays harmless at quota");
const importsLegacy = { ...importsFull, receiptImports: [...importsFull.receiptImports, { importId: "legacy", fingerprint: "b".repeat(64), entryId: "deleted-legacy" }] };
assert.equal(mutateLedger(importsLegacy, income).receiptImports?.length, LEDGER_LIMITS.receiptImports + 1, "Over-limit receipt history does not block manual transactions");

const byteFull = ledger();
byteFull.entries = [entry("padded")];
byteFull.entries[0].description = "x".repeat(LEDGER_LIMITS.bytes - ledgerBytes(byteFull));
assert.equal(ledgerBytes(byteFull), LEDGER_LIMITS.bytes);
assert.doesNotThrow(() => assertLedgerLimits(ledger(), byteFull));
const unicodeGrowth = structuredClone(byteFull);
unicodeGrowth.entries[0].description += "💰";
assert.equal(ledgerBytes(unicodeGrowth), LEDGER_LIMITS.bytes + 4);
assert.throws(() => assertLedgerLimits(byteFull, unicodeGrowth), /Ledger storage limit/);
assert.doesNotThrow(() => assertLedgerLimits(unicodeGrowth, structuredClone(unicodeGrowth)), "Legacy byte overage permits no-growth updates");
assert.doesNotThrow(() => assertLedgerLimits(unicodeGrowth, byteFull), "Legacy byte overage permits reductions");
assert.throws(() => mutateLedger(byteFull, { action: "wallet", id: "bank", name: "Bank renamed", currency: "IDR", amount: "1" }), /Ledger storage limit/);
assert.ok(ledgerBytes(mutateLedger(unicodeGrowth, { ...income, id: "padded", description: "Reduced" })) < LEDGER_LIMITS.bytes, "Legacy oversized details can be edited down");
assert.equal(mutateLedger(unicodeGrowth, { action: "deleteEntry", id: "padded" }).entries.length, 0);

const transfers = ledger();
transfers.entries = [
  entry("opening", { kind: "correction", amount: 1000 }),
  entry("expense", { kind: "expense", amount: 200 }),
  entry("cross", { kind: "transfer", amount: 300, toWallet: "bank", toCurrency: "USD", received: 25 }),
  entry("same-currency", { kind: "transfer", amount: 100, toWallet: "cash", toCurrency: "IDR", received: 100 }),
  entry("fee", { kind: "expense", wallet: "cash", amount: 10, transferId: "same-currency" }),
  entry("income", { wallet: "cash", amount: 5 }),
];
for (const wallet of transfers.wallets)
  for (const currency of wallet.currencies)
    assert.equal(ledgerBalances(transfers).get(wallet.id)?.get(currency), balance(transfers, wallet.id, currency));
assert.equal(ledgerBalances(transfers).get("bank")?.get("IDR"), 400);
assert.equal(ledgerBalances(transfers).get("bank")?.get("USD"), 25);
assert.equal(ledgerBalances(transfers).get("cash")?.get("IDR"), 95);
for (const kind of ["income", "expense", "transfer", "correction"] as const) {
  const overflow = ledger();
  const negative = kind === "expense" || kind === "transfer";
  overflow.entries = [entry("max", { kind: "correction", amount: negative ? -Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER }), entry("overflow", { kind, amount: 1, ...(kind === "transfer" ? { toWallet: "cash", toCurrency: "IDR", received: 1 } : {}) })];
  assert.throws(() => ledgerBalances(overflow), /Balance exceeds/);
  assert.throws(() => balance(overflow, "bank", "IDR"), /Balance exceeds/);
}
const destinationOverflow = ledger();
destinationOverflow.entries = [entry("max-destination", { wallet: "cash", amount: Number.MAX_SAFE_INTEGER }), entry("transfer", { kind: "transfer", toWallet: "cash", toCurrency: "IDR", received: 1, amount: 1 })];
assert.throws(() => ledgerBalances(destinationOverflow), /Balance exceeds/);
const unsafeCorrection = ledger();
unsafeCorrection.entries = [entry("negative", { kind: "correction", amount: -Number.MAX_SAFE_INTEGER })];
assert.throws(() => mutateLedger(unsafeCorrection, { action: "wallet", id: "bank", name: "Bank", currency: "IDR", amount: "999999999999" }), /Balance exceeds/);

console.log("Ledger security checks passed: count and UTF-8 byte quotas, legacy recovery, durable retries, linked fees, one-pass transfer balances, and monetary overflow.");
