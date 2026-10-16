"use client";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { LedgerContext } from "../../ledger-context";
import { useLedger } from "../../hooks";
import { localDate } from "../../format";
import type { LedgerState } from "../../api";
import { type Period } from "../../derive";
import { ExchangeRateProvider } from "@/features/exchange-rates/components/exchange-rate-provider";
import type { Currency } from "../../ledger";
import type { Editor } from "../editor/editor-form";
import { saveBrowserTimeZone } from "../../save-browser-timezone";

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
  const data = useMemo(() => ({ ...ledger.data, entries: editor?.relatedEntries ?? [] }), [ledger.data, editor?.relatedEntries]);
  useEffect(saveBrowserTimeZone, []);
  return <ExchangeRateProvider><LedgerContext.Provider value={{ ...ledger, data, name, email, timeZone, period, setPeriod, currency, setCurrency, balancesVisible, setBalancesVisible, editor, setEditor }}>{children}</LedgerContext.Provider></ExchangeRateProvider>;
}
