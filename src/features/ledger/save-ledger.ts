import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import type { Ledger } from "./ledger";
import { assertLedgerLimits } from "./ledger-limits";

export async function saveLedger(
  userId: string,
  previous: Ledger,
  data: Ledger,
  version: number,
) {
  // Discard image references from legacy imports; images are never persisted.
  for (const entry of data.entries) {
    if (entry.receipt) delete entry.receipt.imageId;
  }
  assertLedgerLimits(previous, data);
  const updated = await db
    .update(ledger)
    .set({ data, version: version + 1 })
    .where(and(eq(ledger.userId, userId), eq(ledger.version, version)))
    .returning({ version: ledger.version });
  return updated.length > 0;
}
