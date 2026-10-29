"use client";

import { useShallow } from "zustand/react/shallow";
import { useLedgerStore } from "./use-ledger-store";

export function useLedgerView() {
  return useLedgerStore(useShallow((state) => ({
    data: state.data, period: state.period, currency: state.currency, timeZone: state.timeZone,
  })));
}
