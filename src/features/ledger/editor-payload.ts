import type { Extraction } from "../receipts/receipts.ts";
import { transactionDetailsSchema, validateTransactionDetails } from "../receipts/receipts.ts";
import type { Entry, Wallet } from "./ledger-model.ts";
import { money } from "./money.ts";
import { localDate } from "./format.ts";

type FormValues = Record<string, FormDataEntryValue>;

function entryDate(value: FormDataEntryValue, entry?: Entry) {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid date and time.");
  // Keep seconds and the original timestamp when the minute-level field is unchanged.
  if (entry && String(value) === localDate(new Date(entry.date))) return entry.date;
  return date.toISOString();
}

export function entryPayload(values: FormValues, entry?: Entry, extraction?: Extraction) {
  const details = values.kind === "transfer" ? undefined : transactionDetailsSchema.parse(JSON.parse(String(values.details)));
  if (details) validateTransactionDetails(details, money(String(values.amount), true));
  const receipt = extraction ? {
    importId: extraction.importId, fingerprint: extraction.fingerprint, method: extraction.method,
    documentKind: extraction.draft.documentKind, merchant: String(values.title), ...details,
  } : entry?.receipt ? { ...entry.receipt, ...details } : undefined;
  return {
    ...values, newCategory: values.newCategory === "true", action: extraction && !entry ? "receipt" : "entry",
    ...(details ? { details: receipt ? undefined : details } : {}), ...(receipt ? { receipt } : {}),
    id: entry?.id, date: entryDate(values.date, entry),
  };
}

export function walletPayload(values: FormValues, wallet?: Wallet) {
  return { ...values, newCategory: values.newCategory === "true", action: "wallet", id: wallet?.id };
}
