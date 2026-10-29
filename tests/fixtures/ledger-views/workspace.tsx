import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createLedgerStore } from "@/features/ledger/ledger-store";
import { LedgerStoreContext } from "@/features/ledger/ledger-store-context";
import { LedgerShell } from "@/features/ledger/components/layout/ledger-shell";
import { RateCacheContext } from "@/features/exchange-rates/rate-cache-context";
import { LedgerViewsPage } from "./page";
import { viewData } from "./data";

export function LedgerViewsWorkspace() {
  const client = useQueryClient();
  const [store] = useState(() => createLedgerStore({ initialState: { data: viewData, version: 1 }, name: "Fixture User", email: "fixture@example.com", initialTimeZone: "Asia/Jakarta", initialMonth: "2026-10" }, client,
    { fetchLedger: async () => ({ data: viewData, version: 1 }), saveLedger: async () => ({ data: viewData, version: 2 }) }));
  useEffect(() => { Object.assign(window, { ledgerViews: { store, client } }); }, [store, client]);
  return <LedgerStoreContext.Provider value={store}><RateCacheContext.Provider value={{ get: async () => ({ rate: "1", rateDate: "2026-10-01", provider: "ecb", lastCheckedAt: "2026-10-01T00:00:00Z", stale: false }), clear() {} }}>
    <LedgerShell><LedgerViewsPage /></LedgerShell>
  </RateCacheContext.Provider></LedgerStoreContext.Provider>;
}
