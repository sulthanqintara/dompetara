import { validRateDate } from "../exchange-rates/exchange-rates.ts";
import { localDate } from "./format.ts";
import type { Currency, Entry, Ledger } from "./ledger.ts";

export type Period = { month: string } | { start: string; end: string };

export function periodRange(period: Period) {
  if ("start" in period) return period;
  const [year, month] = period.month.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return {
    start: `${period.month}-01`,
    end: `${period.month}-${String(date.getUTCDate()).padStart(2, "0")}`,
  };
}

export function validPeriod(start: string, end: string) {
  return validRateDate(start) && validRateDate(end) && start <= end;
}

export function periodLabel(period: Period) {
  return "month" in period ? period.month : `${period.start} – ${period.end}`;
}

export function periodEntries(data: Ledger, period: Period, timeZone?: string): Entry[] {
  const { start, end } = periodRange(period);
  if (!validPeriod(start, end)) return [];
  return data.entries
    .filter((e) => {
      const date = localDate(new Date(e.date), timeZone).slice(0, 10);
      return date >= start && date <= end;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function periodTotals(entries: Entry[], currency: Currency) {
  return entries.reduce(
    (totals, e) => {
      if (e.currency === currency && (e.kind === "income" || e.kind === "expense"))
        totals[e.kind] += e.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}

export function spendByCategory(
  entries: Entry[],
  currency: Currency,
): [string, number][] {
  return Object.entries(
    entries
      .filter((e) => e.kind === "expense" && e.currency === currency)
      .reduce<Record<string, number>>((all, e) => {
        all[e.category] = (all[e.category] || 0) + e.amount;
        return all;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
}

export function categoryBreakdown(groups: [string, number][], expense: number) {
  return groups.map(([category, amount]) => ({
    category,
    amount,
    share: expense > 0 ? amount / expense : 0,
  }));
}

export function walletName(data: Ledger, id?: string) {
  return data.wallets.find((w) => w.id === id)?.name ?? "Wallet";
}

export function spendingHistory(
  entries: Entry[],
  currency: Currency,
  interval: "daily" | "monthly",
  timeZone?: string,
) {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.kind !== "expense" || entry.currency !== currency) continue;
    const date = localDate(new Date(entry.date), timeZone).slice(0, interval === "daily" ? 10 : 7);
    totals[date] = (totals[date] ?? 0) + entry.amount;
  }
  // ponytail: omit zero-spending buckets; fill them if a continuous time axis is needed.
  return Object.keys(totals).sort().map((date) => ({ date, amount: totals[date] }));
}
