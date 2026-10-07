import "server-only";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { receiptImages } from "@/lib/db/schema";
import { readLedger } from "@/features/ledger/read-ledger";
import { receiptImageStorage } from "./receipt-image-storage";
import { logServerError } from "@/lib/log-server-error";

export async function readReceiptImage(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json(
      { error: "Please sign in." },
      { status: 401, headers },
    );
  const parsed = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success)
    return Response.json(
      { error: "Receipt image not found." },
      { status: 404, headers },
    );
  const { data } = await readLedger(session.user.id);
  if (!data.entries.some((entry) => entry.receipt?.imageId === parsed.data))
    return Response.json(
      { error: "Receipt image not found." },
      { status: 404, headers },
    );
  const [row] = await db
    .select()
    .from(receiptImages)
    .where(
      and(
        eq(receiptImages.id, parsed.data),
        eq(receiptImages.userId, session.user.id),
        eq(receiptImages.state, "active"),
      ),
    );
  if (!row)
    return Response.json(
      { error: "Receipt image not found." },
      { status: 404, headers },
    );
  try {
    const stored = await receiptImageStorage("GET", row.id);
    return new Response(stored.body, {
      headers: {
        ...headers,
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'inline; filename="receipt.jpg"',
      },
    });
  } catch (error) {
    logServerError(
      { method: "GET", path: "/api/receipts/image", stage: "download" },
      error,
    );
    return Response.json(
      { error: "Could not load this receipt image. Please retry." },
      { status: 503, headers },
    );
  }
}
