import "server-only";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { receiptImages } from "@/lib/db/schema";
import { receiptImageStorage } from "./receipt-image-storage";
import { logServerError } from "@/lib/log-server-error";

export async function cleanupReceiptImages(userId?: string) {
  const eligible = or(
    eq(receiptImages.state, "deleting"),
    isNull(receiptImages.userId),
    and(
      eq(receiptImages.state, "staged"),
      lt(receiptImages.createdAt, new Date(Date.now() - 3_600_000)),
    ),
  );
  const rows = await db
    .select()
    .from(receiptImages)
    .where(userId ? and(eq(receiptImages.userId, userId), eligible) : eligible)
    .limit(50);
  if (!rows.length) return { removed: 0, failed: 0 };
  const ids = rows.map((row) => row.id);
  try {
    // One bounded Storage call prevents a failing provider from turning fifty
    // queued objects into fifty sequential request timeouts.
    await receiptImageStorage("DELETE", ids);
    await db.delete(receiptImages).where(inArray(receiptImages.id, ids));
    return { removed: rows.length, failed: 0 };
  } catch (error) {
    logServerError(
      { method: "DELETE", path: "receipt-image-storage", stage: "cleanup" },
      error,
    );
    return { removed: 0, failed: rows.length };
  }
}
