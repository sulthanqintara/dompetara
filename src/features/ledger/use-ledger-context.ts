"use client";
import { useContext } from "react";
import { LedgerContext } from "./ledger-context";

export function useLedgerContext() {
  const context = useContext(LedgerContext);
  if (!context) throw new Error("Ledger components require LedgerProvider.");
  return context;
}
