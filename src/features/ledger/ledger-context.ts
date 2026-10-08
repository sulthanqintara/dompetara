"use client";
import { createContext, type Dispatch, type SetStateAction } from "react";
import type { useLedger } from "./hooks";
import type { Currency, Entry } from "./ledger";
import type { Period, periodTotals } from "./derive";
import type { Editor } from "./components/editor/editor-form";

export const LedgerContext = createContext<(ReturnType<typeof useLedger> & {
  name: string; email: string; timeZone: string;
  period: Period; setPeriod: (period: Period) => void;
  periodEntries: Entry[]; periodTotals: ReturnType<typeof periodTotals>;
  currency: Currency; setCurrency: Dispatch<SetStateAction<Currency>>;
  balancesVisible: boolean; setBalancesVisible: Dispatch<SetStateAction<boolean>>;
  editor: Editor | undefined; setEditor: Dispatch<SetStateAction<Editor | undefined>>;
}) | null>(null);
