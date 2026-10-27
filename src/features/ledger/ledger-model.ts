import type { Receipt, TransactionDetails } from "../receipts/receipts.ts";
import type { AppliedRate } from "../exchange-rates/exchange-rates.ts";

export const currencies = ["IDR", "USD", "CAD"] as const;
export type Currency = (typeof currencies)[number];
export type Wallet = { id: string; name: string; currencies: Currency[] };
export type Category = { id: string; name: string; kind: "income" | "expense"; system?: "adminFees" };
export type Entry = {
  id: string;
  kind: "income" | "expense" | "transfer" | "correction";
  date: string;
  wallet: string;
  currency: Currency;
  amount: number;
  title: string;
  category: string;
  categoryId?: string;
  description: string;
  toWallet?: string;
  toCurrency?: Currency;
  received?: number;
  exchangeRate?: AppliedRate;
  transferId?: string;
  receipt?: Receipt;
  details?: TransactionDetails;
};
export type Ledger = {
  wallets: Wallet[];
  categories: Category[];
  entries: Entry[];
  receiptImports?: { importId: string; fingerprint: string; entryId: string }[];
  // Read-only SQL aggregates and archived category labels on the lightweight client view.
  balanceTotals?: Record<string, Partial<Record<Currency, number>>>;
  historicalCategories?: Category[];
};
export function emptyLedger(): Ledger {
  return {
    wallets: [],
    entries: [],
    categories: ["Salary", "Other income"]
      .map<Category>((name) => ({ id: name, name, kind: "income" }))
      .concat(
        ["Food & drink", "Transport", "Entertainment", "Shopping", "Bills"].map(
          (name) => ({ id: name, name, kind: "expense" as const }),
        ),
      ),
  };
}
export function balance(
  data: Ledger,
  wallet: string,
  currency: Currency,
): number {
  if (data.balanceTotals) return data.balanceTotals[wallet]?.[currency] ?? 0;
  let total = 0;
  for (const e of data.entries) {
    if (e.wallet === wallet && e.currency === currency)
      total +=
        e.kind === "expense" || e.kind === "transfer" ? -e.amount : e.amount;
    if (
      e.kind === "transfer" &&
      e.toWallet === wallet &&
      e.toCurrency === currency
    )
      total += e.received!;
    if (!Number.isSafeInteger(total))
      throw new Error("Balance exceeds supported amount.");
  }
  return total;
}

function setBalance(totals: Map<Currency, number>, currency: Currency, amount: number) {
  if (!Number.isSafeInteger(amount)) throw new Error("Balance exceeds supported amount.");
  totals.set(currency, amount);
}

function sourceBalance(previous: number, entry: Entry, sameBalance: boolean) {
  let total = previous + (entry.kind === "expense" || entry.kind === "transfer" ? -entry.amount : entry.amount);
  // Check a same-balance transfer after both movements, preserving their arithmetic order.
  if (sameBalance) total += entry.received!;
  return total;
}

export function ledgerBalances(data: Ledger) {
  const totals = new Map(
    data.wallets.map((wallet) => [
      wallet.id,
      new Map<Currency, number>(wallet.currencies.map((currency) => [currency, 0])),
    ]),
  );
  for (const entry of data.entries) {
    const source = totals.get(entry.wallet);
    const destination = entry.kind === "transfer" ? totals.get(entry.toWallet!) : undefined;
    const sameBalance = destination === source && entry.toCurrency === entry.currency;
    if (source?.has(entry.currency)) {
      setBalance(source, entry.currency, sourceBalance(source.get(entry.currency)!, entry, sameBalance));
    }
    if (destination?.has(entry.toCurrency!) && !sameBalance) {
      setBalance(destination, entry.toCurrency!, destination.get(entry.toCurrency!)! + entry.received!);
    }
  }
  return totals;
}
