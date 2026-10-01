import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { emptyLedger } from "./ledger";

export async function readLedger(userId: string) {
  await db.insert(ledger).values({ userId, data: emptyLedger() }).onConflictDoNothing();
  const [row] = await db.select().from(ledger).where(eq(ledger.userId, userId));
  return { data: row.data, version: row.version };
}
