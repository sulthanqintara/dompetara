import { currencies, type Currency, type Ledger } from "./ledger-model.ts";
import { assertLedgerGrowth } from "./ledger-limits.ts";

export function mutationText(value: unknown, label: string, optional = false) {
  if (typeof value !== "string" || value.length > 1000 || (!optional && !value.trim()))
    throw new Error(`${label} is required (maximum 1,000 characters).`);
  return value.trim();
}

export function mutationCurrency(value: unknown): Currency {
  if (!currencies.includes(value as Currency)) throw new Error("Choose a supported currency.");
  return value as Currency;
}

export function mutationWallet(data: Ledger, id: unknown, currency: Currency) {
  const wallet = data.wallets.find((wallet) => wallet.id === id);
  if (!wallet || !wallet.currencies.includes(currency)) throw new Error("Choose a wallet with this currency.");
  return wallet.id;
}

export function assertActionGrowth(previous: Ledger, payload: Record<string, unknown>) {
  // Reject obvious growth before copying or scanning a large ledger.
  if (payload.action === "wallet" && !payload.id) {
    assertLedgerGrowth(previous, "wallets", 1);
    assertLedgerGrowth(previous, "entries", 1);
  }
  if (payload.action === "category") assertLedgerGrowth(previous, "categories", 1);
  if (payload.action === "entry" && !payload.id) assertLedgerGrowth(previous, "entries", 1);
}
