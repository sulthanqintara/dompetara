import type { Ledger } from "./ledger.ts";
import { z } from "zod";
import { LEDGER_LIMITS, LedgerLimitError, ledgerBytes } from "./ledger-limits.ts";

const dimensions = ["wallets", "categories", "entries", "receiptImports"] as const;
const countSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const ledgerUsageSchema = z.object({ wallets: countSchema, categories: countSchema, entries: countSchema,
  receiptImports: countSchema, bytes: countSchema, nextPosition: countSchema });
export type LedgerUsage = z.infer<typeof ledgerUsageSchema>;
const recordBytes = (records: unknown[] | undefined) => (records ?? []).reduce<number>((total, row) => total + new TextEncoder().encode(JSON.stringify(row)).byteLength, 0);
const commas = (count: number) => Math.max(0, count - 1);
const importFieldBytes = new TextEncoder().encode(',"receiptImports":[]').byteLength;

export function ledgerUsage(data: Ledger, nextPosition = data.entries.length): LedgerUsage {
  return { wallets: data.wallets.length, categories: data.categories.length, entries: data.entries.length,
    receiptImports: data.receiptImports?.length ?? 0, bytes: ledgerBytes(data), nextPosition };
}

// Partial snapshots contain all wallet/category metadata and only the affected entries/imports.
// Array delimiters use the complete counts, including the first/last record in a list.
export function updateLedgerUsage(previous: LedgerUsage, before: Ledger, after: Ledger, nextPosition: number): LedgerUsage {
  const next = { ...previous, nextPosition };
  for (const dimension of dimensions) {
    next[dimension] += (after[dimension]?.length ?? 0) - (before[dimension]?.length ?? 0);
    next.bytes += recordBytes(after[dimension]) - recordBytes(before[dimension]) + commas(next[dimension]) - commas(previous[dimension]);
    if (next[dimension] > LEDGER_LIMITS[dimension] && next[dimension] > previous[dimension]) throw new LedgerLimitError(dimension);
  }
  next.bytes += (next.receiptImports > 0 ? importFieldBytes : 0) - (previous.receiptImports > 0 ? importFieldBytes : 0);
  if (next.bytes > LEDGER_LIMITS.bytes && next.bytes > previous.bytes) throw new LedgerLimitError("bytes");
  return next;
}

export function assertMutationGrowth(usage: LedgerUsage, payload: Record<string, unknown>) {
  const growth = payload.action === "wallet" && !payload.id ? ["wallets", "entries"]
    : payload.action === "category" ? ["categories"]
    : payload.action === "receipt" ? ["entries", "receiptImports"]
    : payload.action === "entry" && !payload.id ? ["entries"] : [];
  for (const dimension of growth as typeof dimensions[number][]) {
    if (usage[dimension] + 1 > LEDGER_LIMITS[dimension]) throw new LedgerLimitError(dimension);
  }
}
