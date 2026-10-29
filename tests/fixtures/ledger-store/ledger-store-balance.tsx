import { useEffect } from "react";
import { useLedgerStore } from "@/features/ledger/use-ledger-store";
import { renders } from "./renders";

export function LedgerStoreBalance() {
  useEffect(() => { renders.balance++; });
  const visible = useLedgerStore((state) => state.balancesVisible);
  const toggle = useLedgerStore((state) => state.setBalancesVisible);
  return <button id="balance" onClick={() => toggle((value) => !value)}>{String(visible)}</button>;
}
