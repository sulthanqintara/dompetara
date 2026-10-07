import { z } from "zod";
import { money } from "../ledger/money.ts";
import type { Wallet } from "../ledger/ledger.ts";

const text = z.string().trim().max(1000);
const amount = z
  .string()
  .regex(
    /^-?\d{1,12}(\.\d{1,2})?$/,
    "Use an amount without thousands separators.",
  );
const itemSchema = z.object({
  name: text.min(1),
  quantity: z.number().positive().max(100000).nullable(),
  unitPrice: amount.nullable(),
  lineTotal: amount.nullable(),
});
const adjustmentSchema = z.object({ label: text.min(1), amount });
export const draftSchema = z.object({
  documentKind: z.enum(["receipt", "payment", "unknown"]),
  merchant: text.nullable(),
  date: z.iso.date().nullable(),
  time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  currency: z.enum(["IDR", "USD", "CAD"]).nullable(),
  receiptNumber: text.nullable(),
  total: amount.nullable(),
  items: z.array(itemSchema).max(200),
  adjustments: z.array(adjustmentSchema).max(30),
  warnings: z.array(text).max(20),
  paymentSource: text.nullable().default(null),
  suggestedWallet: z.object({ walletId: text.min(1), reason: text.min(1) })
    .nullable().default(null),
  suggestedCategory: z
    .object({ name: text.min(1), reason: text.min(1) })
    .nullable()
    .default(null),
});
// Normalize provider formatting only; saved amounts retain strict decimal validation.
const providerAmount = z.string().trim().transform((value) =>
  /^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(value)
    ? value.replace(/,/g, "")
    : /^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)
    ? value.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(?:\.\d{3})+$/.test(value) ||
  /^-?\d{1,3}(?:,\d{3})+$/.test(value)
    ? value.replace(/[.,]/g, "")
    : value,
).pipe(amount);
export const providerDraftSchema = draftSchema.extend({
  total: providerAmount.nullable(),
  time: z.string().transform((value) =>
    /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)
      ? value.slice(0, 5)
      : value,
  ).pipe(draftSchema.shape.time.unwrap()).nullable(),
  items: z.array(itemSchema.extend({
    unitPrice: providerAmount.nullable(),
    lineTotal: providerAmount.nullable(),
  })).max(200),
  adjustments: z.array(adjustmentSchema.extend({ amount: providerAmount })).max(30)
    .transform((rows) => rows.filter((row) =>
      !/^(?:sub\s*total|grand\s*total|total|before\s*rounding|total\s*before\s*rounding)$/i.test(row.label),
    )),
});
export const transactionDetailsSchema = z.object({
  receiptNumber: text.nullable(),
  keepItems: z.boolean(),
  items: z.array(itemSchema).max(200),
  adjustments: z.array(adjustmentSchema).max(30),
});
export type TransactionDetails = z.infer<typeof transactionDetailsSchema>;
export const receiptSchema = z.object({
  imageId: z.uuid().optional(),
  importId: z.uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  method: z.enum(["ocr", "ai"]),
  documentKind: draftSchema.shape.documentKind,
  merchant: text.nullable(),
  receiptNumber: text.nullable(),
  keepItems: z.boolean(),
  paymentConfirmed: z.boolean(),
  items: z.array(itemSchema).max(200),
  adjustments: z.array(adjustmentSchema).max(30),
});
export const extractionSchema = z.object({
  draft: draftSchema,
  importId: z.uuid(),
  fingerprint: receiptSchema.shape.fingerprint,
  method: receiptSchema.shape.method,
});
export type Draft = z.infer<typeof draftSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Extraction = z.infer<typeof extractionSchema>;

export function suggestReceiptWallet(draft: Draft, wallets: Wallet[]) {
  const normalize = (value: string) => value.toLowerCase()
    .replace(/\bbank\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const source = normalize(draft.paymentSource ?? "");
  if (!source || !draft.currency) return null;
  const matches = wallets.filter((wallet) =>
    wallet.currencies.some((currency) => currency === draft.currency) &&
    ` ${normalize(wallet.name)} `.includes(` ${source} `),
  );
  if (matches.length !== 1) return null;
  return {
    walletId: matches[0].id,
    reason: draft.suggestedWallet?.walletId === matches[0].id
      ? draft.suggestedWallet.reason
      : `The visible payment source ${draft.paymentSource} matches ${matches[0].name}.`,
  };
}

export function validateReceipt(receipt: Receipt, total: number) {
  if (receipt.documentKind !== "receipt" && !receipt.paymentConfirmed)
    throw new Error(
      "Confirm this payment is spending. Use a transfer for money moved between your own wallets.",
    );
  validateTransactionDetails(receipt, total);
}

export function validateTransactionDetails(receipt: TransactionDetails, total: number) {
  if (!receipt.keepItems) {
    if (receipt.items.length || receipt.adjustments.length)
      throw new Error("Total-only receipts cannot contain item details.");
    return;
  }
  if (!receipt.items.length) throw new Error("Add items or choose total only.");
  if (transactionDetailsTotal(receipt) !== BigInt(total))
    throw new Error(
      "Items plus tax, service charges, discounts and rounding must equal the final total. Correct the details or choose total only.",
    );
}

export function transactionDetailsTotal(receipt: TransactionDetails) {
  return (
    receipt.items.reduce((sum, item) => {
      if (item.lineTotal === null)
        throw new Error(
          "Enter every item's line total before saving item details.",
        );
      const value = money(item.lineTotal);
      if (value < 0)
        throw new Error(
          "Item totals cannot be negative. Use an adjustment for discounts.",
        );
      if (item.unitPrice !== null && money(item.unitPrice) < 0)
        throw new Error("Unit prices cannot be negative.");
      return sum + BigInt(value);
    }, BigInt(0)) +
    receipt.adjustments.reduce(
      (sum, adjustment) => sum + BigInt(money(adjustment.amount)),
      BigInt(0),
    )
  );
}

export function receiptDetailsMatch(draft: Draft) {
  if (!draft.total || !draft.items.length) return false;
  try {
    return transactionDetailsTotal({ ...draft, keepItems: true }) === BigInt(money(draft.total));
  } catch {
    return false;
  }
}

export function transactionDetailsDifference(details: TransactionDetails, amount: string) {
  if (!details.items.length) return null;
  try {
    const total = transactionDetailsTotal(details);
    return { total, difference: BigInt(money(amount, true)) - total };
  } catch {
    return null;
  }
}
