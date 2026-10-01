"use client";
import { createContext, type Dispatch, type SetStateAction } from "react";
import type { useLedger } from "./hooks";
import type { Currency } from "./ledger";
import type { Period } from "./derive";
import type { Editor } from "./components/editor-form";

export const LedgerContext = createContext<(ReturnType<typeof useLedger> & {
  name: string; email: string; timeZone: string;
  period: Period; setPeriod: (period: Period) => void;
  currency: Currency; setCurrency: Dispatch<SetStateAction<Currency>>;
  editor: Editor | undefined; setEditor: Dispatch<SetStateAction<Editor | undefined>>;
}) | null>(null);
