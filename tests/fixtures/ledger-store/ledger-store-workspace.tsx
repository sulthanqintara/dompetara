import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LedgerProvider } from "@/features/ledger/components/layout/ledger-provider";
import { emptyLedger } from "@/features/ledger/ledger";
import { LedgerStoreName } from "./ledger-store-name";
import { LedgerStoreBalance } from "./ledger-store-balance";
import { LedgerStoreView } from "./ledger-store-view";

export function LedgerStoreWorkspace({ account }: { account: string }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><LedgerProvider initialState={{ data: emptyLedger(), version: 1 }} name={account} email={`${account}@example.com`} initialTimeZone="UTC" initialMonth="2026-10">
    <LedgerStoreName /><LedgerStoreBalance /><LedgerStoreView />
  </LedgerProvider></QueryClientProvider>;
}
