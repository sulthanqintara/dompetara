import Form from "next/form";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currencies, type Ledger } from "../../ledger";
import type { TransactionFilters as Filters } from "../../transaction-filters";
import { LedgerSelect } from "../shared/ledger-select";

export function TransactionFilters({ data, filters }: { data: Ledger; filters: Filters }) {
  const id = useId();
  const categories = [...new Set([...data.categories.map((category) => category.name),
    ...data.entries.map((entry) => entry.category).filter(Boolean)])].sort();
  return <Form action="/transactions" scroll={false} className="transaction-filters" aria-label="Filter transaction history">
    <div className="form-field transaction-search">
      <Label htmlFor={id}>Search transactions</Label>
      <Input id={id} name="search" type="search" maxLength={1000} defaultValue={filters.search} placeholder="Title, notes, category or wallet" />
    </div>
    <LedgerSelect label="Wallet" name="wallet" defaultValue={filters.wallet}
      options={[{ value: "all", label: "All wallets" }, ...data.wallets.map((wallet) => ({ value: wallet.id, label: wallet.name }))]} />
    <LedgerSelect label="Category" name="category" defaultValue={filters.category}
      options={[{ value: "all", label: "All categories" }, ...categories.map((name) => ({ value: name, label: name }))]} />
    <LedgerSelect label="Transaction type" name="type" defaultValue={filters.type}
      options={[{ value: "all", label: "All types" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" },
        { value: "transfer", label: "Transfer" }, { value: "correction", label: "Opening balances & corrections" }]} />
    <LedgerSelect label="Transaction currency" name="currency" defaultValue={filters.currency}
      options={[{ value: "all", label: "All currencies" }, ...currencies.map((value) => ({ value, label: value }))]} />
    <div className="transaction-filter-actions">
      <Button type="submit">Apply filters</Button>
      <Button variant="outline" nativeButton={false} render={<Link href="/transactions" scroll={false} />}>Clear filters</Button>
    </div>
    <p className="hint transaction-search">Filters apply within the selected period. Transfers match either wallet and either currency. Summary totals use the period and summary currency.</p>
  </Form>;
}
