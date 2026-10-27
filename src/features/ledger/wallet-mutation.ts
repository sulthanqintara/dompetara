import { balance, type Ledger } from "./ledger-model.ts";
import { money } from "./money.ts";
import { mutationCurrency, mutationText } from "./mutation-input.ts";

export function saveWallet(data: Ledger, payload: Record<string, unknown>) {
  const name = mutationText(payload.name, "Wallet name");
  let wallet = data.wallets.find((wallet) => wallet.id === payload.id);
  if (payload.id) {
    if (!wallet) throw new Error("Wallet not found.");
    wallet.name = name;
  } else {
    wallet = { id: crypto.randomUUID(), name, currencies: [] };
    data.wallets.push(wallet);
  }
  const currency = mutationCurrency(payload.currency);
  const delta = money(payload.amount) - balance(data, wallet!.id, currency);
  if (!Number.isSafeInteger(delta)) throw new Error("Balance exceeds supported amount.");
  const opening = !wallet!.currencies.includes(currency);
  if (opening) wallet!.currencies.push(currency);
  if (delta || opening) data.entries.push({
    id: crypto.randomUUID(), kind: "correction", date: new Date().toISOString(),
    wallet: wallet!.id, currency, amount: delta,
    title: opening ? "Opening balance" : "Balance correction", category: "", description: "",
  });
}

export function deleteWallet(data: Ledger, id: unknown) {
  if (data.entries.some((entry) => entry.wallet === id || entry.toWallet === id))
    throw new Error("Wallets with ledger history cannot be deleted.");
  data.wallets = data.wallets.filter((wallet) => wallet.id !== id);
}
