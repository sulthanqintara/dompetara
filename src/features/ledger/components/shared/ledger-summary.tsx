"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useLedgerContext } from "../../use-ledger-context";
import { FiltersBar } from "../filters/filters-bar";
import { SummarySkeleton } from "./summary-skeleton";
import { LedgerQueryError } from "./ledger-query-error";
import { StatsBar } from "./stats-bar";
import { ledgerQuery, type QueryState, type LedgerOverview } from "../../query";
import { useLedgerQuery } from "../../use-ledger-query";
import { fetchOverview } from "../../api";
import { QueryRefreshStatus } from "./query-refresh-status";

export function LedgerSummary({ initial }: { initial?: QueryState<LedgerOverview> }) {
  const { data, period, setPeriod, currency, setCurrency, timeZone } = useLedgerContext();
  const query = useMemo(() => ledgerQuery(period, timeZone, currency, { scope: "summary" }), [period, timeZone, currency]);
  const { result: overview, error: overviewError, refreshing, displayedQuery } = useLedgerQuery("overview", query, fetchOverview, initial);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  return <>
    <FiltersBar period={period} currency={currency} onCurrencyChange={setCurrency} onPeriodChange={(next) => {
      setPeriod(next);
      if (pathname === "/transactions") {
        const params = new URLSearchParams(searchParams);
        params.delete("page");
        window.history.replaceState(null, "", `/transactions${params.size ? `?${params}` : ""}`);
      }
    }} />
    <div className="ledger-query-content" aria-busy={refreshing}>
      <QueryRefreshStatus refreshing={refreshing} />
      {overviewError && <LedgerQueryError error={overviewError} />}
      {!overview ? overviewError ? null : <SummarySkeleton /> : <StatsBar {...overview.totals} data={data} currency={displayedQuery?.displayCurrency ?? currency} />}
    </div>
  </>;
}
