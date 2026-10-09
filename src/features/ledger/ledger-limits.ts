import type { Ledger } from "./ledger.ts";

export const LEDGER_LIMITS = {
  wallets: 50,
  categories: 200,
  entries: 10_000,
  receiptImports: 10_000,
  bytes: 3_000_000,
} as const;

const limitErrors = {
  wallets: "Wallet limit reached. Remove a wallet before adding another.",
  categories: "Category limit reached. Remove a category before adding another.",
  entries: "Transaction limit reached. Remove a transaction before adding another.",
  receiptImports: "Receipt import limit reached. Save this transaction manually.",
  bytes: "Ledger storage limit reached. Remove transaction details before adding more data.",
} as const;

export class LedgerLimitError extends Error {
  constructor(dimension: keyof typeof limitErrors) {
    super(limitErrors[dimension], { cause: 400 });
    this.name = "LedgerLimitError";
  }
}

export function assertLedgerGrowth(
  previous: Ledger,
  dimension: "wallets" | "categories" | "entries" | "receiptImports",
  additional: number,
) {
  if (additional > 0 && (previous[dimension]?.length ?? 0) + additional > LEDGER_LIMITS[dimension])
    throw new LedgerLimitError(dimension);
}

export function ledgerBytes(data: Ledger) {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}

export function assertLedgerLimits(previous: Ledger, next: Ledger) {
  for (const dimension of ["wallets", "categories", "entries", "receiptImports"] as const) {
    const nextCount = next[dimension]?.length ?? 0;
    // Existing overages can be reduced or edited without locking owners out.
    if (nextCount > LEDGER_LIMITS[dimension] && nextCount > (previous[dimension]?.length ?? 0))
      throw new LedgerLimitError(dimension);
  }
  const bytes = ledgerBytes(next);
  if (bytes > LEDGER_LIMITS.bytes && bytes > ledgerBytes(previous))
    throw new LedgerLimitError("bytes");
}
