import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger, receiptImages } from "@/lib/db/schema";
import type { Ledger } from "./ledger";
import { assertLedgerLimits } from "./ledger-limits";
import { cleanupReceiptImages } from "@/features/receipts/cleanup-receipt-images";
import { logServerError } from "@/lib/log-server-error";

export async function saveLedger(
  userId: string,
  previous: Ledger,
  data: Ledger,
  version: number,
) {
  // Keep legacy storage records only for cleanup. New saves never retain images.
  const removed = previous.entries.flatMap((entry) =>
    entry.receipt?.imageId ? [entry.receipt.imageId] : [],
  );
  for (const entry of data.entries) {
    if (entry.receipt) delete entry.receipt.imageId;
  }
  assertLedgerLimits(previous, data);
  const saved = await db.transaction(async (tx) => {
    const updated = await tx
      .update(ledger)
      .set({ data, version: version + 1 })
      .where(and(eq(ledger.userId, userId), eq(ledger.version, version)))
      .returning({ version: ledger.version });
    if (!updated.length) return false;
    if (removed.length)
      await tx
        .update(receiptImages)
        .set({ state: "deleting" })
        .where(
          and(eq(receiptImages.userId, userId), inArray(receiptImages.id, removed)),
        );
    return true;
  });
  if (saved && removed.length) {
    try {
      await cleanupReceiptImages(userId);
    } catch (error) {
      // A committed ledger save succeeds even when physical deletion needs retry.
      logServerError(
        { method: "POST", path: "/api/ledger", stage: "legacy image cleanup" },
        error,
      );
    }
  }
  return saved;
}
