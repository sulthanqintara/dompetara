import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { measureServerStage } from "@/lib/measure-server-stage";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";
import { ensureLedger } from "./server/ensure-ledger";
import { readLedgerData } from "./server/read-ledger-data";
import { readLedgerSnapshot } from "./server/read-ledger-snapshot";

export async function readLedger(userId: string, context: Parameters<typeof measureServerStage>[0] = {
  requestId: crypto.randomUUID(), source: "ledger-read",
}, full = false) {
  await measureServerStage(context, "ledger.admission", () => enforceUserLimit(userId, "ledger-read"));
  if (!full) {
    let snapshot = await measureServerStage(context, "ledger.select", () => readLedgerSnapshot(db, userId));
    if (!snapshot) {
      await measureServerStage(context, "ledger.ensure-row", () => ensureLedger(userId));
      snapshot = await measureServerStage(context, "ledger.select", () => readLedgerSnapshot(db, userId));
    }
    if (!snapshot) throw new Error("Ledger storage upgrade is required. Please try again later.");
    return snapshot;
  }
  await measureServerStage(context, "ledger.ensure-row", () => ensureLedger(userId));
  return measureServerStage(context, "ledger.select", () => db.transaction(async (tx) => {
    const [row] = await tx.select({ version: ledger.version }).from(ledger).where(eq(ledger.userId, userId));
    return { data: await readLedgerData(tx, userId, full), version: row.version };
  }, { isolationLevel: "repeatable read", accessMode: "read only" }));
}
