import { receiptSchema } from "../receipts/receipts.ts";
import { assertLedgerGrowth, assertLedgerLimits } from "./ledger-limits.ts";
import { ledgerBalances, type Ledger } from "./ledger-model.ts";
import { assertActionGrowth } from "./mutation-input.ts";
import { saveWallet, deleteWallet } from "./wallet-mutation.ts";
import { saveCategory } from "./category-mutation.ts";
import { mutateEntry } from "./entry-mutation.ts";

export { money } from "./money.ts";
export { currencies, emptyLedger, balance, ledgerBalances } from "./ledger-model.ts";
export type { Currency, Wallet, Category, Entry, Ledger } from "./ledger-model.ts";

function importReceipt(previous: Ledger, payload: Record<string, unknown>): Ledger {
  const receipt = receiptSchema.parse(payload.receipt);
  if (previous.receiptImports?.some((saved) => saved.importId === receipt.importId || saved.fingerprint === receipt.fingerprint))
    return structuredClone(previous);
  assertLedgerGrowth(previous, "receiptImports", 1);
  const result = mutateLedger(previous, { ...payload, action: "entry", id: undefined, receipt });
  result.receiptImports = [
    ...(previous.receiptImports ?? []),
    { importId: receipt.importId, fingerprint: receipt.fingerprint, entryId: result.entries.at(-1)!.id },
  ];
  assertLedgerLimits(previous, result);
  return result;
}

export function mutateLedger(previous: Ledger, raw: unknown): Ledger {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid request.");
  const payload = raw as Record<string, unknown>;
  if (payload.action === "receipt") return importReceipt(previous, payload);
  assertActionGrowth(previous, payload);
  const data = structuredClone(previous);
  switch (payload.action) {
    case "wallet": saveWallet(data, payload); break;
    case "deleteWallet": deleteWallet(data, payload.id); break;
    case "category": saveCategory(data, payload); break;
    case "deleteCategory": data.categories = data.categories.filter((category) => category.id !== payload.id); break;
    case "entry":
    case "deleteEntry": mutateEntry(data, payload); break;
    default: throw new Error("Unknown action.");
  }
  assertLedgerLimits(previous, data);
  ledgerBalances(data);
  return data;
}
