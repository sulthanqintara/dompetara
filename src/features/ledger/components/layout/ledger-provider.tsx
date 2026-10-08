"use client";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { LedgerContext } from "../../ledger-context";
import { useLedger } from "../../hooks";
import { localDate } from "../../format";
import type { LedgerState } from "../../api";
import { periodEntries, periodTotals, type Period } from "../../derive";
import { ExchangeRateProvider } from "@/features/exchange-rates/components/exchange-rate-provider";
import type { Currency } from "../../ledger";
import type { Editor } from "../editor/editor-form";

export function LedgerProvider({ children, initialState, name, email, initialTimeZone, initialMonth }: {
  children: ReactNode; initialState: LedgerState; name: string; email: string; initialTimeZone: string; initialMonth: string;
}) {
  const ledger = useLedger(initialState);
  const [selectedPeriod, setPeriod] = useState<Period>();
  const [currency, setCurrency] = useState<Currency>("IDR");
  const [balancesVisible, setBalancesVisible] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const timeZone = useSyncExternalStore(() => () => {}, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => initialTimeZone);
  const defaultMonth = timeZone === initialTimeZone ? initialMonth : localDate(new Date(), timeZone).slice(0, 7);
  const period = useMemo(() => selectedPeriod ?? { month: defaultMonth }, [selectedPeriod, defaultMonth]);
  const entries = useMemo(() => periodEntries(ledger.data, period, timeZone), [ledger.data, period, timeZone]);
  const totals = useMemo(() => periodTotals(entries, currency), [entries, currency]);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `ledger-timezone=${encodeURIComponent(zone)}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  return <ExchangeRateProvider><LedgerContext.Provider value={{ ...ledger, name, email, timeZone, period, setPeriod, periodEntries: entries, periodTotals: totals, currency, setCurrency, balancesVisible, setBalancesVisible, editor, setEditor }}>{children}</LedgerContext.Provider></ExchangeRateProvider>;
}
