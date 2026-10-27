import { useState } from "react";
import type { Draft } from "../receipts/receipts";
import type { Currency, Entry, Ledger } from "./ledger";
import { initialEntryFields, changeSourceCurrency, changeSourceWallet } from "./entry-editor";

export function useEntryFields(data: Ledger, entry?: Entry, draft?: Draft) {
  const [initial] = useState(() => initialEntryFields(data, entry, draft));
  const [values, setValues] = useState(initial);
  return {
    initial, values,
    setAmount: (amount: string) => setValues((current) => ({ ...current, amount })),
    setDate: (date: string) => setValues((current) => ({ ...current, date })),
    setCurrency: (currency: string) => setValues((current) => changeSourceCurrency(current, data, currency as Currency)),
    setWallet: (wallet: string) => setValues((current) => changeSourceWallet(current, wallet)),
    setToCurrency: (toCurrency: string) => setValues((current) => ({ ...current, toCurrency: toCurrency as Currency, toWallet: "" })),
    setToWallet: (toWallet: string) => setValues((current) => ({ ...current, toWallet })),
  };
}
