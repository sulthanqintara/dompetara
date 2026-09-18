import { localDate } from "./format";
import type { Currency, Entry, Ledger } from "./ledger";

export function monthlyEntries(data: Ledger, month: string): Entry[] {
  return data.entries
    .filter((e) => localDate(new Date(e.date)).slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function spendByCategory(
  data: Ledger,
  month: string,
  currency: Currency,
): [string, number][] {
  return Object.entries(
    monthlyEntries(data, month)
      .filter((e) => e.kind === "expense" && e.currency === currency)
      .reduce<Record<string, number>>((all, e) => {
        all[e.category] = (all[e.category] || 0) + e.amount;
        return all;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
}

export function walletName(data: Ledger, id?: string) {
  return data.wallets.find((w) => w.id === id)?.name ?? "Wallet";
}
