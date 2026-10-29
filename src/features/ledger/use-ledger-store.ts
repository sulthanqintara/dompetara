"use client";
import { useContext } from "react";
import { useStore } from "zustand";
import { LedgerStoreContext } from "./ledger-store-context";
import type { LedgerStoreState } from "./ledger-store";

export function useLedgerStore<T>(selector: (state: LedgerStoreState) => T): T {
  const store = useContext(LedgerStoreContext);
  if (!store) throw new Error("Ledger components require LedgerProvider.");
  return useStore(store, selector);
}
