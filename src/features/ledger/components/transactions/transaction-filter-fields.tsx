import { useTranslations } from "next-intl";
import { categoryLabel } from "@/features/i18n/format";
import { currencies, type Ledger } from "../../ledger";
import type { TransactionFilters as Filters } from "../../transaction-filters";
import { LedgerSelect } from "../shared/ledger-select";

export function TransactionFilterFields({ data, filters, onChange }: {
  data: Ledger;
  filters: Filters;
  onChange?: (filters: Filters) => void;
}) {
  const t = useTranslations("UI");
  const categories = [...new Set([...data.categories.map((category) => category.name),
    ...data.entries.map((entry) => entry.category).filter(Boolean)])].sort();
  return <>
    <LedgerSelect label={t("wallet")} name="wallet" defaultValue={onChange ? undefined : filters.wallet} value={onChange ? filters.wallet : undefined}
      onValueChange={(value) => onChange?.({ ...filters, wallet: value })}
      options={[{ value: "all", label: t("allWallets") }, ...data.wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))]} />
    <LedgerSelect label={t("category")} name="category" defaultValue={onChange ? undefined : filters.category} value={onChange ? filters.category : undefined}
      onValueChange={(value) => onChange?.({ ...filters, category: value })}
      options={[{ value: "all", label: t("allCategories") }, ...categories.map((name) => ({ value: name, label: categoryLabel(data, name, t) }))]} />
    <LedgerSelect label={t("transactionType")} name="type" defaultValue={onChange ? undefined : filters.type} value={onChange ? filters.type : undefined}
      onValueChange={(value) => onChange?.({ ...filters, type: value as Filters["type"] })}
      options={[{ value: "all", label: t("allTypes") }, { value: "income", label: t("income") }, { value: "expense", label: t("expense") },
        { value: "transfer", label: t("transfer") }, { value: "correction", label: t("openingBalancesCorrections") }]} />
    <LedgerSelect label={t("transactionCurrency")} name="currency" defaultValue={onChange ? undefined : filters.currency} value={onChange ? filters.currency : undefined}
      onValueChange={(value) => onChange?.({ ...filters, currency: value as Filters["currency"] })}
      options={[{ value: "all", label: t("allCurrencies") }, ...currencies.map((value) => ({ value, label: value }))]} />
  </>;
}
