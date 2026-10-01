"use client";
import { useLedgerContext } from "../use-ledger-context";
import { periodEntries, periodLabel } from "../derive";
import { LedgerSummary } from "./ledger-summary";
import { TransactionsTab } from "./transactions-tab";

export function TransactionsPage({ page }: { page: string | string[] | undefined }) {
  const { data, period, setEditor, timeZone } = useLedgerContext();
  return <>
    <LedgerSummary />
    <TransactionsTab data={data} entries={periodEntries(data, period, timeZone)} periodLabel={periodLabel(period)} page={page} timeZone={timeZone}
      onEditEntry={(entry) => setEditor({ type: "entry", entry })} onAddWallet={() => setEditor({ type: "wallet" })} />
  </>;
}
