"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LedgerContext } from "../../ledger-context";
import { useLedger } from "../../hooks";
import { localDate } from "../../format";
import type { LedgerState } from "../../api";
import type { Period } from "../../derive";
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
  const period = selectedPeriod ?? { month: timeZone === initialTimeZone ? initialMonth : localDate(new Date(), timeZone).slice(0, 7) };
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `ledger-timezone=${encodeURIComponent(zone)}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === "https:" ? "; Secure" : ""}`;
  }, []);
  return <LedgerContext.Provider value={{ ...ledger, name, email, timeZone, period, setPeriod, currency, setCurrency, balancesVisible, setBalancesVisible, editor, setEditor }}>{children}</LedgerContext.Provider>;
}
