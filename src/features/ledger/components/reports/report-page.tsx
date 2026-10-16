"use client";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { categoryLabel } from "@/features/i18n/format";
import { useLedgerContext } from "../../use-ledger-context";
import { LedgerSummary } from "../shared/ledger-summary";
import { ReportTab } from "./report-tab";
import { ReportSkeleton } from "../shared/report-skeleton";
import { LedgerQueryError } from "../shared/ledger-query-error";
import { ledgerQuery, queryPeriod, type QueryState, type LedgerOverview } from "../../query";
import { useLedgerQuery } from "../../use-ledger-query";
import { fetchOverview } from "../../api";
import { QueryRefreshStatus } from "../shared/query-refresh-status";

export function ReportPage({ initial }: { initial: QueryState<LedgerOverview> }) {
  const t = useTranslations("UI");
  const { data, period, currency, timeZone } = useLedgerContext();
  const query = useMemo(() => ledgerQuery(period, timeZone, currency, { scope: "report" }), [period, timeZone, currency]);
  const { result: overview, error: overviewError, refreshing, displayedQuery } = useLedgerQuery("overview", query, fetchOverview, initial);
  return <>
    <LedgerSummary initial={{ ...initial, query: { ...initial.query, scope: "summary" }, result: { totals: initial.result.totals, groups: [], daily: [], monthly: [] } }} />
    <div className="ledger-query-content" aria-busy={refreshing}>
    <QueryRefreshStatus refreshing={refreshing} />
    {overviewError && <LedgerQueryError error={overviewError} />}
    {!overview ? overviewError ? null : <ReportSkeleton /> :
      <ReportTab groups={overview.groups.map(([name, amount]) => [categoryLabel(data, name, t), amount])}
        expense={overview.totals.expense} currency={displayedQuery?.displayCurrency ?? currency} period={displayedQuery ? queryPeriod(displayedQuery) : period} daily={overview.daily} monthly={overview.monthly} />}
    </div>
  </>;
}
