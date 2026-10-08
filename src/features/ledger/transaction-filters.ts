import { z } from "zod";
import { currencies, type Entry, type Ledger } from "./ledger.ts";
import { walletName } from "./derive.ts";

export const transactionFiltersSchema = z.object({
  search: z.string().max(1000).catch(""),
  wallet: z.string().max(1000).catch("all"),
  category: z.string().max(1000).catch("all"),
  type: z.enum(["all", "income", "expense", "transfer", "correction"]).catch("all"),
  currency: z.enum(["all", ...currencies]).catch("all"),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export function readTransactionSearchParams(params: Pick<URLSearchParams, "forEach">) {
  const result: Record<string, string | string[] | undefined> = Object.create(null);
  params.forEach((value, key) => {
    const saved = result[key];
    result[key] = saved === undefined ? value : Array.isArray(saved) ? [...saved, value] : [saved, value];
  });
  return result;
}

export function filterTransactions(entries: Entry[], data: Ledger, filters: TransactionFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  return entries.filter((entry) =>
    (filters.wallet === "all" || entry.wallet === filters.wallet || entry.toWallet === filters.wallet) &&
    (filters.category === "all" || entry.category === filters.category) &&
    (filters.type === "all" || entry.kind === filters.type) &&
    (filters.currency === "all" || entry.currency === filters.currency || entry.toCurrency === filters.currency) &&
    (!search || [entry.title, entry.description, entry.category, walletName(data, entry.wallet),
      entry.toWallet ? walletName(data, entry.toWallet) : ""].join(" ").toLocaleLowerCase().includes(search)),
  );
}
