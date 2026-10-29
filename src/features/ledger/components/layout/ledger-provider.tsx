"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LedgerStoreContext } from "../../ledger-store-context";
import { createLedgerStore, type LedgerStoreInitial } from "../../ledger-store";
import { fetchLedger, saveLedger } from "../../api";
import { localDate } from "../../format";
import { ExchangeRateProvider } from "@/features/exchange-rates/components/exchange-rate-provider";
import { saveBrowserTimeZone } from "../../save-browser-timezone";

export function LedgerProvider({ children, ...initial }: LedgerStoreInitial & { children: ReactNode }) {
  const client = useQueryClient();
  const [store] = useState(() => createLedgerStore(initial, client, { fetchLedger, saveLedger }));
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const defaultMonth = timeZone === initial.initialTimeZone ? initial.initialMonth : localDate(new Date(), timeZone).slice(0, 7);
    store.getState().setTimeZone(timeZone, defaultMonth);
    saveBrowserTimeZone();
  }, [store, initial.initialTimeZone, initial.initialMonth]);
  return <ExchangeRateProvider><LedgerStoreContext.Provider value={store}>{children}</LedgerStoreContext.Provider></ExchangeRateProvider>;
}
