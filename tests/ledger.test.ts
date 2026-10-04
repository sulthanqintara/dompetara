import assert from "node:assert/strict";
import {
  balance,
  emptyLedger,
  money,
  mutateLedger,
} from "../src/features/ledger/ledger.ts";
import { receivedAfterFee } from "../src/features/ledger/transfer.ts";
let data = emptyLedger();
const apply = (p: Record<string, unknown>) => {
  data = mutateLedger(data, p);
};
apply({ action: "wallet", name: "BCA", currency: "IDR", amount: "1000" });
const bca = data.wallets[0].id;
apply({
  action: "wallet",
  id: bca,
  name: "BCA",
  currency: "USD",
  amount: "10.25",
});
apply({ action: "wallet", name: "Cash", currency: "IDR", amount: "0" });
const cash = data.wallets[1].id;
const base = {
  action: "entry",
  date: "2026-09-01T03:30:00.000Z",
  wallet: bca,
  currency: "IDR",
  description: "",
};
apply({
  ...base,
  kind: "income",
  amount: "500",
  title: "Pay",
  category: "Salary",
});
apply({
  ...base,
  kind: "expense",
  amount: "100.25",
  title: "Karaokean",
  category: "Entertainment",
});
const expense = data.entries.at(-1)!;
assert.equal(balance(data, bca, "IDR"), 139975);
apply({
  ...base,
  id: expense.id,
  kind: "expense",
  amount: "50",
  title: "Karaokean",
  category: "Entertainment",
});
assert.equal(balance(data, bca, "IDR"), 145000);
apply({
  ...base,
  kind: "transfer",
  amount: "200",
  toWallet: cash,
  toCurrency: "IDR",
});
const transfer = data.entries.at(-1)!;
assert.equal(balance(data, cash, "IDR"), 20000);
apply({
  ...base,
  id: transfer.id,
  kind: "transfer",
  amount: "100",
  toWallet: bca,
  toCurrency: "USD",
  received: "0.01",
});
assert.equal(balance(data, cash, "IDR"), 0);
assert.equal(balance(data, bca, "USD"), 1026);
apply({ action: "deleteEntry", id: transfer.id });
assert.equal(balance(data, bca, "USD"), 1025);
apply({
  action: "wallet",
  id: bca,
  name: "BCA renamed",
  currency: "IDR",
  amount: "2000",
});
assert.equal(balance(data, bca, "IDR"), 200000);
assert.equal(data.entries.at(-1)!.kind, "correction");
apply({ action: "deleteCategory", id: "Entertainment" });
assert.equal(
  data.entries.find((e) => e.id === expense.id)!.category,
  "Entertainment",
);
apply({ action: "deleteEntry", id: expense.id });
assert.equal(balance(data, bca, "IDR"), 205000);
assert.equal(money("0.29"), 29);
for (const amount of ["NaN", "1e3", "1.001", "", "Infinity", 100])
  assert.throws(() => money(amount));
assert.throws(() => money("0", true));
assert.throws(() =>
  mutateLedger(data, {
    ...base,
    kind: "transfer",
    amount: "1",
    toWallet: bca,
    toCurrency: "IDR",
  }),
);
assert.throws(() =>
  mutateLedger(data, {
    ...base,
    wallet: "another-users-wallet",
    kind: "income",
    amount: "1",
    title: "Invalid",
    category: "Salary",
  }),
);
assert.throws(() =>
  mutateLedger(data, {
    ...base,
    kind: "income",
    amount: "1",
    title: "Invalid",
    category: "Entertainment",
  }),
);
assert.throws(() =>
  mutateLedger(data, { action: "deleteEntry", id: data.entries[0].id }),
);
assert.throws(() => mutateLedger(data, { action: "deleteWallet", id: bca }));
assert.deepEqual(emptyLedger().wallets, []);
const beforeFee = structuredClone(data);
apply({
  ...base,
  kind: "transfer",
  amount: "200000",
  toWallet: cash,
  toCurrency: "IDR",
  feeAmount: "1000",
  feeChargedTo: "destination",
});
const feeTransfer = data.entries.findLast((e) => e.kind === "transfer")!;
const fee = data.entries.find((e) => e.transferId === feeTransfer.id)!;
assert.equal(fee.kind, "expense");
assert.equal(fee.wallet, cash);
assert.equal(fee.amount, 100000);
assert.equal(fee.category, "Admin fees");
assert.equal(
  balance(data, bca, "IDR"),
  balance(beforeFee, bca, "IDR") - 20000000,
);
assert.equal(balance(data, cash, "IDR"), 19900000);
assert.equal(receivedAfterFee(data, feeTransfer), 19900000);
assert.throws(() => mutateLedger(data, { action: "deleteEntry", id: fee.id }));
assert.throws(() =>
  mutateLedger(data, {
    ...base,
    id: fee.id,
    kind: "expense",
    amount: "10",
    title: "Fee",
    category: "Admin fees",
  }),
);
for (const invalidFee of ["-1", "200000", "200001", "1.001"])
  assert.throws(() =>
    mutateLedger(beforeFee, {
      ...base,
      kind: "transfer",
      amount: "200000",
      toWallet: cash,
      toCurrency: "IDR",
      feeAmount: invalidFee,
      feeChargedTo: "destination",
    }),
  );
apply({
  ...base,
  id: feeTransfer.id,
  kind: "transfer",
  amount: "200000",
  toWallet: cash,
  toCurrency: "IDR",
  feeAmount: "1000",
  feeChargedTo: "source",
});
assert.equal(
  data.entries.filter((e) => e.transferId === feeTransfer.id).length,
  1,
);
assert.equal(
  data.entries.find((e) => e.transferId === feeTransfer.id)!.id,
  fee.id,
);
assert.equal(
  balance(data, bca, "IDR"),
  balance(beforeFee, bca, "IDR") - 20100000,
);
assert.equal(balance(data, cash, "IDR"), 20000000);
assert.equal(
  receivedAfterFee(
    data,
    data.entries.find((e) => e.id === feeTransfer.id)!,
  ),
  20000000,
);
apply({
  ...base,
  id: feeTransfer.id,
  kind: "transfer",
  amount: "200000",
  toWallet: cash,
  toCurrency: "IDR",
  feeAmount: "0",
});
assert.equal(
  data.entries.some((e) => e.transferId === feeTransfer.id),
  false,
);
apply({
  ...base,
  id: feeTransfer.id,
  kind: "transfer",
  amount: "200000",
  toWallet: cash,
  toCurrency: "IDR",
  feeAmount: "1000",
  feeChargedTo: "destination",
});
apply({ action: "deleteEntry", id: feeTransfer.id });
assert.deepEqual(data.entries, beforeFee.entries);
apply({
  ...base,
  kind: "transfer",
  amount: "17800",
  toWallet: bca,
  toCurrency: "USD",
  received: "1",
  exchangeRate: "0.000056179775",
  rateSource: "manual",
  feeAmount: "0.10",
  feeChargedTo: "destination",
});
const crossTransfer = data.entries.findLast((e) => e.kind === "transfer")!;
assert.equal(crossTransfer.exchangeRate!.value, "0.000056179775");
assert.equal(balance(data, bca, "USD"), balance(beforeFee, bca, "USD") + 90);
assert.equal(
  data.entries.find((e) => e.transferId === crossTransfer.id)!.currency,
  "USD",
);
apply({
  ...base,
  id: crossTransfer.id,
  kind: "expense",
  amount: "10",
  title: "Reclassified",
  category: "Admin fees",
});
assert.equal(
  data.entries.some((e) => e.transferId === crossTransfer.id),
  false,
);
assert.equal(balance(data, bca, "USD"), balance(beforeFee, bca, "USD"));
apply({
  action: "wallet",
  id: bca,
  name: "BCA",
  currency: "CAD",
  amount: "200",
});
const cadTransfer = {
  ...base,
  kind: "transfer",
  currency: "CAD",
  amount: "159.33",
  toWallet: cash,
  toCurrency: "IDR",
  received: "2000000",
  rateSource: "received",
};
const beforeCad = data;
apply(cadTransfer);
const actualTransfer = data.entries.findLast((e) => e.kind === "transfer")!;
assert.equal(actualTransfer.amount, 15933);
assert.equal(actualTransfer.received, 200000000);
assert.equal(actualTransfer.exchangeRate!.value, "12552.563861168644");
assert.equal(balance(data, bca, "CAD"), 4067);
assert.equal(
  balance(data, cash, "IDR"),
  balance(beforeCad, cash, "IDR") + 200000000,
);
apply({ ...cadTransfer, id: actualTransfer.id, amount: "160" });
assert.equal(
  data.entries.find((e) => e.id === actualTransfer.id)!.received,
  200000000,
);
assert.equal(
  data.entries.find((e) => e.id === actualTransfer.id)!.exchangeRate!.value,
  "12500",
);
// Inline creation is atomic, applies to both kinds, and reuses names case-insensitively.
for (const kind of ["expense", "income"] as const) {
  const previous = data;
  const payload = { ...base, kind, amount: "1", title: "Inline category", category: "Gift purchases", newCategory: true };
  apply(payload);
  assert.equal(previous.categories.some((c) => c.name === "Gift purchases" && c.kind === kind), false);
  assert.equal(data.entries.at(-1)!.category, "Gift purchases");
  apply({ ...payload, category: "gift purchases" });
  assert.equal(data.categories.filter((c) => c.name.toLowerCase() === "gift purchases" && c.kind === kind).length, 1);
  assert.equal(data.entries.at(-1)!.category, "Gift purchases");
  const beforeFailure = structuredClone(data);
  assert.throws(() => mutateLedger(data, { ...payload, category: "Failed category", wallet: "missing" }), /wallet/i);
  assert.deepEqual(data, beforeFailure);
}
console.log(
  "Ledger checks passed: exact money, corrections, transfers, rate snapshots, linked source/destination fees, atomic fee edits/removal, categories, and ownership references.",
);
