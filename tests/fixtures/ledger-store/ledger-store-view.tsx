import { useEffect } from "react";
import { useLedgerView } from "@/features/ledger/use-ledger-view";
import { useLedgerStore } from "@/features/ledger/use-ledger-store";
import { renders } from "./renders";

export function LedgerStoreView() {
  const { data, period, currency, timeZone } = useLedgerView();
  const setCurrency = useLedgerStore((state) => state.setCurrency);
  useEffect(() => { renders.view++; });
  return <button id="view" onClick={() => setCurrency("USD")}>{currency}:{timeZone}:{"month" in period ? period.month : period.start}:{data.wallets.length}</button>;
}
