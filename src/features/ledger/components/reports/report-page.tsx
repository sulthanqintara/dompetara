"use client";
import { useLedgerContext } from "../../use-ledger-context";
import { periodEntries, periodTotals, spendByCategory, spendingHistory } from "../../derive";
import { LedgerSummary } from "../shared/ledger-summary";
import { ReportTab } from "./report-tab";

export function ReportPage() {
  const { data, period, currency, timeZone } = useLedgerContext();
  const entries = periodEntries(data, period, timeZone);
  return <>
    <LedgerSummary />
    <ReportTab groups={spendByCategory(entries, currency)} expense={periodTotals(entries, currency).expense} currency={currency} period={period}
      daily={spendingHistory(entries, currency, "daily", timeZone)} monthly={spendingHistory(data.entries, currency, "monthly", timeZone)} />
  </>;
}
