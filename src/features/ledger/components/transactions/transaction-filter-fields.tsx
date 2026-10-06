import { currencies, type Ledger } from "../../ledger";
import type { TransactionFilters as Filters } from "../../transaction-filters";
import { LedgerSelect } from "../shared/ledger-select";

export function TransactionFilterFields({ data, filters, onChange }: {
  data: Ledger;
  filters: Filters;
  onChange?: (filters: Filters) => void;
}) {
  const categories = [...new Set([...data.categories.map((category) => category.name),
    ...data.entries.map((entry) => entry.category).filter(Boolean)])].sort();
  return <>
    <LedgerSelect label="Wallet" name="wallet" defaultValue={onChange ? undefined : filters.wallet} value={onChange ? filters.wallet : undefined}
      onValueChange={(value) => onChange?.({ ...filters, wallet: value })}
      options={[{ value: "all", label: "All wallets" }, ...data.wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))]} />
    <LedgerSelect label="Category" name="category" defaultValue={onChange ? undefined : filters.category} value={onChange ? filters.category : undefined}
      onValueChange={(value) => onChange?.({ ...filters, category: value })}
      options={[{ value: "all", label: "All categories" }, ...categories.map((name) => ({ value: name, label: name }))]} />
    <LedgerSelect label="Transaction type" name="type" defaultValue={onChange ? undefined : filters.type} value={onChange ? filters.type : undefined}
      onValueChange={(value) => onChange?.({ ...filters, type: value as Filters["type"] })}
      options={[{ value: "all", label: "All types" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" },
        { value: "transfer", label: "Transfer" }, { value: "correction", label: "Opening balances & corrections" }]} />
    <LedgerSelect label="Transaction currency" name="currency" defaultValue={onChange ? undefined : filters.currency} value={onChange ? filters.currency : undefined}
      onValueChange={(value) => onChange?.({ ...filters, currency: value as Filters["currency"] })}
      options={[{ value: "all", label: "All currencies" }, ...currencies.map((value) => ({ value, label: value }))]} />
  </>;
}
