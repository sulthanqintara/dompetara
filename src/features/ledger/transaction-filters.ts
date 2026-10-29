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

export function transactionFiltersHref(values: Record<string, unknown>) {
  const filters = transactionFiltersSchema.parse(values);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && (key === "search" || value !== "all")) params.set(key, value);
  }
  return `/transactions${params.size ? `?${params}` : ""}`;
}

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
  return entries.filter((entry) => matchesTransactionFields(entry, filters) && matchesTransactionSearch(entry, data, search));
}

function matchesEither(filter: string, source: string, destination?: string) {
  return filter === "all" || filter === source || filter === destination;
}

function matchesTransactionFields(entry: Entry, filters: TransactionFilters) {
  return [matchesEither(filters.wallet, entry.wallet, entry.toWallet), matchesEither(filters.category, entry.category),
    matchesEither(filters.type, entry.kind), matchesEither(filters.currency, entry.currency, entry.toCurrency)].every(Boolean);
}

function matchesTransactionSearch(entry: Entry, data: Ledger, search: string) {
  if (!search) return true;
  return [entry.title, entry.description, entry.category, walletName(data, entry.wallet),
    entry.toWallet ? walletName(data, entry.toWallet) : ""].join(" ").toLocaleLowerCase().includes(search);
}
