import { useEffect } from "react";
import { useLedgerStore } from "@/features/ledger/use-ledger-store";
import { renders } from "./renders";

export function LedgerStoreName() {
  useEffect(() => { renders.name++; });
  const name = useLedgerStore((state) => state.name);
  return <span id="name">{name}</span>;
}
