import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledger, receiptImages } from "@/lib/db/schema";
import type { Ledger } from "@/features/ledger/ledger";
import { normalizeReceiptImage } from "./normalize-receipt-image";
import { receiptImageStorage } from "./receipt-image-storage";
import { cleanupReceiptImages } from "./cleanup-receipt-images";
import { logServerError } from "@/lib/log-server-error";

export async function saveLedgerImages(
  userId: string,
  previous: Ledger,
  data: Ledger,
  version: number,
  payload: Record<string, unknown>,
  file?: File,
) {
  // Image references are server-managed. Never accept another user's object ID,
  // or let a stale edit restore an image that has already been removed.
  const previousImages = new Map(
    previous.entries.map((entry) => [entry.id, entry.receipt?.imageId]),
  );
  for (const entry of data.entries) {
    if (!entry.receipt) continue;
    const trusted = previousImages.get(entry.id);
    delete entry.receipt.imageId;
    if (
      trusted &&
      !(
        (payload.action === "removeReceiptImage" ||
          (payload.action === "entry" &&
            payload.removeReceiptImage === true)) &&
        payload.id === entry.id
      )
    )
      entry.receipt.imageId = trusted;
  }
  let imageId: string | undefined;
  try {
    if (file) {
      const entry =
        payload.action === "receipt"
          ? data.entries.find(
              (entry) =>
                entry.receipt?.importId ===
                (payload.receipt as { importId?: string })?.importId,
            )
          : payload.action === "entry"
            ? data.entries.find((entry) => entry.id === payload.id)
            : undefined;
      if (!entry?.receipt)
        throw new Error("Save images only with a receipt transaction.");
      const bytes = await normalizeReceiptImage(file);
      imageId = crypto.randomUUID();
      // Persist the cleanup record BEFORE upload, so a timeout or process crash
      // cannot leave an untracked object. Staged objects expire after one hour.
      await db
        .insert(receiptImages)
        .values({ id: imageId, userId, state: "staged" });
      await receiptImageStorage("POST", imageId, bytes);
      entry.receipt.imageId = imageId;
    }
    const retained = new Set(
      data.entries.flatMap((entry) =>
        entry.receipt?.imageId ? [entry.receipt.imageId] : [],
      ),
    );
    const removed = previous.entries.flatMap((entry) =>
      entry.receipt?.imageId && !retained.has(entry.receipt.imageId)
        ? [entry.receipt.imageId]
        : [],
    );
    const saved = await db.transaction(async (tx) => {
      const updated = await tx
        .update(ledger)
        .set({ data, version: version + 1 })
        .where(and(eq(ledger.userId, userId), eq(ledger.version, version)))
        .returning({ version: ledger.version });
      if (!updated.length) return false;
      if (imageId) {
        const activated = await tx
          .update(receiptImages)
          .set({ state: "active" })
          .where(
            and(
              eq(receiptImages.id, imageId),
              eq(receiptImages.userId, userId),
              eq(receiptImages.state, "staged"),
            ),
          )
          .returning({ id: receiptImages.id });
        if (!activated.length)
          throw new Error("Receipt image save expired. Please retry.");
      }
      if (removed.length)
        await tx
          .update(receiptImages)
          .set({ state: "deleting" })
          .where(
            and(
              eq(receiptImages.userId, userId),
              inArray(receiptImages.id, removed),
            ),
          );
      return true;
    });
    if (!saved && imageId)
      await db
        .update(receiptImages)
        .set({ state: "deleting" })
        .where(eq(receiptImages.id, imageId));
    // Failed deletion stays queued. Never report a committed ledger save as a
    // failure just because storage cleanup needs another attempt.
    try {
      if (imageId || removed.length) await cleanupReceiptImages(userId);
    } catch (error) {
      logServerError(
        { method: "POST", path: "/api/ledger", stage: "image cleanup" },
        error,
      );
    }
    return saved;
  } catch (error) {
    if (imageId) {
      try {
        await db
          .update(receiptImages)
          .set({ state: "deleting" })
          .where(eq(receiptImages.id, imageId));
        await cleanupReceiptImages(userId);
      } catch (cleanupError) {
        logServerError(
          {
            method: "POST",
            path: "/api/ledger",
            stage: "failed upload cleanup",
          },
          cleanupError,
        );
      }
    }
    throw error;
  }
}
