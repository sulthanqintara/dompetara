import type { Draft } from "../receipts/receipts.ts";
import type { Currency, Entry, Ledger } from "./ledger-model.ts";
import { localDate } from "./format.ts";
import { minorText } from "./transfer.ts";

export function initialEntryFields(data: Ledger, entry?: Entry, draft?: Draft, now = new Date()) {
  if (entry) return {
    amount: minorText(entry.amount), date: localDate(new Date(entry.date)), currency: entry.currency,
    toCurrency: entry.toCurrency ?? entry.currency, wallet: entry.wallet, toWallet: entry.toWallet ?? "",
  };
  if (draft) {
    const currency = (draft.currency ?? "") as Currency;
    return { amount: draft.total ?? "", date: `${draft.date ?? ""}T${draft.time ?? ""}`,
      currency, toCurrency: currency, wallet: draft.suggestedWallet?.walletId ?? "", toWallet: "" };
  }
  const currency = data.wallets[0]?.currencies[0] ?? "IDR";
  return { amount: "", date: localDate(now), currency, toCurrency: currency,
    wallet: data.wallets.find((wallet) => wallet.currencies.includes(currency))?.id ?? "", toWallet: "" };
}

export type EntryFieldValues = ReturnType<typeof initialEntryFields>;

export function changeSourceCurrency(values: EntryFieldValues, data: Ledger, currency: Currency): EntryFieldValues {
  const wallet = data.wallets.find((wallet) => wallet.currencies.includes(currency))?.id ?? "";
  return changeSourceWallet({ ...values, currency }, wallet);
}

export function changeSourceWallet(values: EntryFieldValues, wallet: string): EntryFieldValues {
  const collision = wallet === values.toWallet && values.currency === values.toCurrency;
  return { ...values, wallet, toWallet: collision ? "" : values.toWallet };
}

export function destinationWallets(data: Ledger, values: EntryFieldValues) {
  return data.wallets.filter((wallet) => wallet.currencies.includes(values.toCurrency) && !(wallet.id === values.wallet && values.currency === values.toCurrency));
}

export function entryCategories(data: Ledger, kind: Entry["kind"], entry?: Entry) {
  const names = data.categories.filter((category) => category.kind === kind).map((category) => category.name);
  if (entry?.kind === kind && !names.includes(entry.category)) names.unshift(entry.category);
  return names;
}

export function initialTransactionDetails(entry?: Entry, draft?: Draft) {
  if (entry?.details) return entry.details;
  if (entry?.receipt) return entry.receipt;
  if (draft) return { receiptNumber: draft.receiptNumber, keepItems: false, items: draft.items, adjustments: draft.adjustments };
}
