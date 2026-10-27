import { receiptSchema, transactionDetailsSchema, validateReceipt, validateTransactionDetails, type Receipt } from "../receipts/receipts.ts";
import type { Entry, Ledger } from "./ledger-model.ts";

export function setEntryDetails(data: Ledger, entry: Entry, payload: Record<string, unknown>, existing?: Entry) {
  if (entry.kind !== "transfer" && (payload.details || existing?.details)) {
    entry.details = transactionDetailsSchema.parse(payload.details ?? existing?.details);
    validateTransactionDetails(entry.details, entry.amount);
  }
  if (!(payload.receipt || existing?.receipt)) return;
  if (entry.kind !== "expense") throw new Error("A receipt must be saved as an expense.");
  entry.receipt = receiptSchema.parse({ ...(payload.receipt ?? existing?.receipt) as Receipt, ...(entry.details ?? {}) });
  // Legacy image references must not be restored by an edit.
  delete entry.receipt.imageId;
  validateReceipt(entry.receipt, entry.amount);
  if (!existing && data.entries.some((saved) => saved.receipt?.fingerprint === entry.receipt?.fingerprint))
    throw new Error("This image has already been imported.");
}
