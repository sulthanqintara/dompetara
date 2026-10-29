"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useLedgerStore } from "../../use-ledger-store";
import { useLedgerView } from "../../use-ledger-view";
import type { Entry } from "../../ledger";
import { periodLabel } from "../../derive";
import { LedgerSummary } from "../shared/ledger-summary";
import { readTransactionSearchParams, transactionFiltersSchema } from "../../transaction-filters";
import { TransactionFilters } from "./transaction-filters";
import { TransactionsTab } from "./transactions-tab";
import { ledgerQuery, queryPeriod, type QueryState, type TransactionResult, type LedgerOverview } from "../../query";
import { useLedgerQuery } from "../../use-ledger-query";
import { fetchTransactions } from "../../api";
import { TransactionsSkeleton } from "../shared/transactions-skeleton";
import { QueryRefreshStatus } from "../shared/query-refresh-status";
import { LedgerQueryError } from "../shared/ledger-query-error";

export function TransactionsPage({ initial, initialSummary }: { initial: QueryState<TransactionResult>; initialSummary: QueryState<LedgerOverview> }) {
  const t = useTranslations("UI");
  const urlParams = useSearchParams();
  const searchParams = useMemo(() => readTransactionSearchParams(urlParams), [urlParams]);
  const { data, period, currency, timeZone } = useLedgerView();
  const setEditor = useLedgerStore((state) => state.setEditor);
  const filters = useMemo(() => transactionFiltersSchema.parse(searchParams), [searchParams]);
  const query = useMemo(() => ledgerQuery(period, timeZone, currency, searchParams), [period, timeZone, currency, searchParams]);
  const { result, error, refreshing, displayedQuery } = useLedgerQuery("transactions", query, fetchTransactions, initial);
  const pageData = result ? { ...data, entries: result.related } : data;
  const editEntry = (entry: Entry) => setEditor({ type: "entry", entry, relatedEntries: pageData.entries });
  const addWallet = () => setEditor({ type: "wallet" });
  return <>
    <LedgerSummary initial={initialSummary} />
    <TransactionFilters key={JSON.stringify(filters)} data={data} filters={filters} pending={refreshing} />
    <div className="ledger-query-content" aria-busy={refreshing} aria-label={t("transactionHistory")}>
    <QueryRefreshStatus refreshing={refreshing} />
    {error && <LedgerQueryError error={error} />}
    {!result ? error ? null : <TransactionsSkeleton /> :
      <TransactionsTab data={pageData} entries={result.rows} periodLabel={periodLabel(displayedQuery ? queryPeriod(displayedQuery) : period)} pagination={result} timeZone={timeZone}
        onEditEntry={editEntry} onAddWallet={addWallet} />}
    </div>
  </>;
}
