"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLedgerContext } from "../../use-ledger-context";
import { periodLabel } from "../../derive";
import { LedgerSummary } from "../shared/ledger-summary";
import { filterTransactions, readTransactionSearchParams, transactionFiltersSchema } from "../../transaction-filters";
import { TransactionFilters } from "./transaction-filters";
import { TransactionsTab } from "./transactions-tab";

export function TransactionsPage() {
  const urlParams = useSearchParams();
  const searchParams = useMemo(() => readTransactionSearchParams(urlParams), [urlParams]);
  const { data, period, setEditor, timeZone, periodEntries: selectedEntries } = useLedgerContext();
  const filters = useMemo(() => transactionFiltersSchema.parse(searchParams), [searchParams]);
  const entries = useMemo(() => filterTransactions(selectedEntries, data, filters), [selectedEntries, data, filters]);
  return <>
    <LedgerSummary />
    <TransactionFilters key={JSON.stringify(filters)} data={data} filters={filters} />
    <TransactionsTab data={data} entries={entries} periodLabel={periodLabel(period)} page={searchParams.page} timeZone={timeZone}
      onEditEntry={(entry) => setEditor({ type: "entry", entry })} onAddWallet={() => setEditor({ type: "wallet" })} />
  </>;
}
