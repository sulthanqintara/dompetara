import "server-only";
import { eq, and, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger, ledgerReceiptImports } from "@/lib/db/schema";
import { mutateLedger } from "./ledger";
import { receiptSchema } from "../receipts/receipts";
import { readLedgerData } from "./server/read-ledger-data";
import { writeLedgerChanges } from "./server/write-ledger-changes";
import { LedgerMutationError } from "./mutation";
import { ledgerUsage, ledgerUsageSchema, updateLedgerUsage, assertMutationGrowth } from "./usage";
import { readMutationContext } from "./server/read-mutation-context";
import { validateAffectedBalances } from "./server/validate-affected-balances";
import { safeAggregate } from "./query";
import { ledgerFromRows } from "./storage";

export async function saveLedger(userId: string, payload: Record<string, unknown>, version: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ version: ledger.version, normalized: ledger.normalized, usage: ledger.usage, usageVersion: ledger.usageVersion }).from(ledger).where(eq(ledger.userId, userId)).for("update");
    if (!row?.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
    if (payload.action === "receipt") {
      const receipt = receiptSchema.safeParse(payload.receipt);
      if (receipt.success) {
        const [imported] = await tx.select({ importId: ledgerReceiptImports.importId }).from(ledgerReceiptImports).where(and(eq(ledgerReceiptImports.userId, userId), or(eq(ledgerReceiptImports.importId, receipt.data.importId), eq(ledgerReceiptImports.fingerprint, receipt.data.fingerprint))));
        if (imported) return { data: await readLedgerData(tx, userId), version: row.version, notice: "Receipt already imported. No additional expense was saved." };
      }
    }
    if (row.version !== version) return null;
    try {
      const parsedUsage = ledgerUsageSchema.safeParse(row.usage);
      let usage = parsedUsage.success ? parsedUsage.data : null;
      if (!usage || row.usageVersion !== row.version) {
        // Repair once after a legacy compatible writer or fixture; routine saves never load the full ledger.
        const snapshot = await readLedgerData(tx, userId, true);
        const positions = await tx.execute<{ next: number }>(sql`select coalesce(max(position), -1) + 1 as next from ledger_transactions where user_id = ${userId}`);
        usage = ledgerUsage(snapshot, positions.rows[0].next);
      }
      assertMutationGrowth(usage, payload);
      const context = await readMutationContext(tx, userId, payload);
      if (context.walletHasHistory) throw new Error("Wallets with ledger history cannot be deleted.");
      if (context.duplicateReceipt) throw new Error("This image has already been imported.");
      const previous = { ...ledgerFromRows(context.wallets, context.categories, [], []), entries: context.entries };
      const mutationInput = payload.action === "wallet" ? { ...previous, balanceTotals: {
        [String(payload.id ?? "")]: { [String(payload.currency ?? "")]: safeAggregate(context.walletBalance) },
      } } : previous;
      const data = mutateLedger(mutationInput, payload);
      delete data.balanceTotals;
      const changes = await writeLedgerChanges(tx, userId, previous, data, { ...context, nextPosition: usage.nextPosition, nextImportPosition: usage.receiptImports });
      const nextUsage = updateLedgerUsage(usage, changes.before, changes.after, changes.nextPosition);
      await validateAffectedBalances(tx, userId, [...changes.before.entries, ...changes.after.entries]);
      await tx.update(ledger).set({ version: row.version + 1, usage: nextUsage, usageVersion: row.version + 1 }).where(eq(ledger.userId, userId));
      const patch = { before: changes.before.entries, after: changes.after.entries, invalidateTransactions: changes.invalidateTransactions };
      // Large legacy receipt/details edits still return a bounded response and refresh the client cache.
      const boundedPatch = new TextEncoder().encode(JSON.stringify(patch)).byteLength <= 200_000 ? patch : undefined;
      return { data: await readLedgerData(tx, userId), version: row.version + 1,
        changes: boundedPatch };
    } catch (error) {
      // Provider/SQL errors retain their server-side diagnostics and map to a 503.
      if (error && typeof error === "object" && ("query" in error || "code" in error)) throw error;
      throw new LedgerMutationError(error instanceof Error && error.name !== "ZodError" ? error.message : "Check the receipt fields and amounts.", { cause: error });
    }
  });
}
