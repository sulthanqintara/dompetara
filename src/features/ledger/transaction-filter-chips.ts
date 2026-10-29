import { categoryLabel } from "../i18n/format.ts";
import type { Ledger } from "./ledger";
import type { TransactionFilters } from "./transaction-filters";

type Translate = (key: string, values?: Record<string, string | number>) => string;
const typeLabels = { income: "income", expense: "expense", transfer: "transfer", correction: "openingBalancesCorrections", all: "allTypes" };

function filterLabel(key: keyof TransactionFilters, data: Ledger, filters: TransactionFilters, t: Translate) {
  switch (key) {
    case "search": return t("searchFilter", { value: filters.search });
    case "wallet": return t("walletFilter", { value: data.wallets.find((wallet) => wallet.id === filters.wallet)?.name ?? filters.wallet });
    case "category": return t("categoryFilter", { value: categoryLabel(data, filters.category, t) });
    case "currency": return t("currencyFilter", { value: filters.currency });
    case "type": return t("typeFilter", { value: t(typeLabels[filters.type]) });
  }
}

export function transactionFilterChips(data: Ledger, filters: TransactionFilters, t: Translate) {
  const keys: (keyof TransactionFilters)[] = ["search", "wallet", "category", "type", "currency"];
  return keys.filter((key) => filters[key] && (key === "search" || filters[key] !== "all"))
    .map((key) => ({ key, label: filterLabel(key, data, filters, t) }));
}
