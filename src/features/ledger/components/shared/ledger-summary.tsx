"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLedgerContext } from "../../use-ledger-context";
import { FiltersBar } from "../filters/filters-bar";
import { StatsBar } from "./stats-bar";

export function LedgerSummary() {
  const { data, period, setPeriod, currency, setCurrency, periodTotals: totals } = useLedgerContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  return <>
    <FiltersBar period={period} currency={currency} onCurrencyChange={setCurrency} onPeriodChange={(next) => {
      setPeriod(next);
      if (pathname === "/transactions") {
        const params = new URLSearchParams(searchParams);
        params.delete("page");
        router.replace(`/transactions${params.size ? `?${params}` : ""}`, { scroll: false });
      }
    }} />
    <StatsBar {...totals} data={data} currency={currency} />
  </>;
}
