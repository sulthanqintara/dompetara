"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { periodEntries, periodLabel } from "../../derive";
import { LedgerSummary } from "../shared/ledger-summary";
import { filterTransactions, transactionFiltersSchema } from "../../transaction-filters";
import { TransactionFilters } from "./transaction-filters";
import { TransactionsTab } from "./transactions-tab";

export function TransactionsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { data, period, setEditor, timeZone } = useLedgerContext();
  const filters = transactionFiltersSchema.parse(searchParams);
  const entries = filterTransactions(periodEntries(data, period, timeZone), data, filters);
  return <>
    <LedgerSummary />
    <TransactionFilters key={JSON.stringify(filters)} data={data} filters={filters} />
    <TransactionsTab data={data} entries={entries} periodLabel={periodLabel(period)} page={searchParams.page} timeZone={timeZone}
      onEditEntry={(entry) => setEditor({ type: "entry", entry })} onAddWallet={() => setEditor({ type: "wallet" })} />
  </>;
}
