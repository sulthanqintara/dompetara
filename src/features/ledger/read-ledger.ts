import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { emptyLedger } from "./ledger";
import { randomUUID } from "node:crypto";
import { measureServerStage } from "@/lib/measure-server-stage";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";

export async function readLedger(userId: string, context: Parameters<typeof measureServerStage>[0] = {
  requestId: randomUUID(), source: "ledger-read",
}) {
  await enforceUserLimit(userId, "ledger-read");
  await measureServerStage(context, "ledger.ensure-row", async () => {
    await db.insert(ledger).values({ userId, data: emptyLedger() }).onConflictDoNothing();
  });
  const [row] = await measureServerStage(context, "ledger.select", async () =>
    db.select().from(ledger).where(eq(ledger.userId, userId)));
  return { data: row.data, version: row.version };
}
