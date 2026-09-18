import assert from "node:assert/strict";
import {
  balance,
  emptyLedger,
  money,
  mutateLedger,
} from "../src/features/ledger/ledger.ts";
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
console.log(
  "Ledger checks passed: exact money, opening balances, corrections, edits, deletion, transfers, categories, ownership references.",
);
