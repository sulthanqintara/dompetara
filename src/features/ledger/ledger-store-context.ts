"use client";
import { createContext } from "react";
import type { LedgerStore } from "./ledger-store";

// Only the stable store instance travels through context; Zustand handles state subscriptions.
export const LedgerStoreContext = createContext<LedgerStore | null>(null);
