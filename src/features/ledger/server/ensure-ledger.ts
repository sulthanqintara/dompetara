import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { emptyLedger } from "../ledger";
import { writeLedgerChanges } from "./write-ledger-changes";

export async function ensureLedger(userId: string) {
  const [existing] = await db.select({ normalized: ledger.normalized }).from(ledger).where(eq(ledger.userId, userId));
  if (existing) {
    if (!existing.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
    return;
  }
  await db.transaction(async (tx) => {
    const data = emptyLedger();
    const created = await tx.insert(ledger).values({ userId, data, normalized: true }).onConflictDoNothing().returning({ userId: ledger.userId });
    if (created.length) await writeLedgerChanges(tx, userId, { wallets: [], categories: [], entries: [] }, data);
  });
  const [row] = await db.select({ version: ledger.version, normalized: ledger.normalized }).from(ledger).where(eq(ledger.userId, userId));
  if (!row?.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
}
