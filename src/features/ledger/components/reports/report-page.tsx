"use client";
import { useMemo } from "react";
import { useLedgerContext } from "../../use-ledger-context";
import { spendByCategory, spendingHistory } from "../../derive";
import { LedgerSummary } from "../shared/ledger-summary";
import { ReportTab } from "./report-tab";

export function ReportPage() {
  const { data, period, currency, timeZone, periodEntries: entries, periodTotals: totals } = useLedgerContext();
  const groups = useMemo(() => spendByCategory(entries, currency), [entries, currency]);
  const daily = useMemo(() => spendingHistory(entries, currency, "daily", timeZone), [entries, currency, timeZone]);
  const monthly = useMemo(() => spendingHistory(data.entries, currency, "monthly", timeZone), [data.entries, currency, timeZone]);
  return <>
    <LedgerSummary />
    <ReportTab groups={groups} expense={totals.expense} currency={currency} period={period}
      daily={daily} monthly={monthly} />
  </>;
}
