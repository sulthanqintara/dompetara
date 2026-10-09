import { readLimitedBody } from "@/lib/read-limited-body";
import { receiptSchema } from "@/features/receipts/receipts";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { mutateLedger } from "@/features/ledger/ledger";
import { readLedger } from "@/features/ledger/read-ledger";
import { eq } from "drizzle-orm";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";
import { logServerError } from "@/lib/log-server-error";
import { saveLedgerImages } from "@/features/receipts/save-ledger-images";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";

export const GET = withApiErrorLogging(async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  return Response.json(await readLedger(session.user.id), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const POST = withApiErrorLogging(async (request: Request) => {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  await enforceUserLimit(session.user.id, "ledger-write");
  let payload;
  let image: File | undefined;
  try {
    if (
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      const body = await readLimitedBody(request.body, 4_400_000);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": request.headers.get("content-type")! },
        body: new Uint8Array(body),
      }).formData();
      const json = form.get("payload");
      const file = form.get("image");
      if (
        typeof json !== "string" ||
        Buffer.byteLength(json) > 300000 ||
        !(file instanceof File)
      )
        throw new Error("Invalid upload.");
      payload = JSON.parse(json);
      image = file;
    } else {
      const body = await readLimitedBody(request.body, 300000);
      payload = JSON.parse(body.toString("utf8"));
    }
  } catch (error) {
    logServerError(
      { method: "POST", path: "/api/ledger", stage: "parse request" },
      error,
    );
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const [row] = await db
    .select()
    .from(ledger)
    .where(eq(ledger.userId, session.user.id));
  if (row && payload?.action === "receipt") {
    const parsed = receiptSchema.safeParse(payload.receipt);
    if (
      parsed.success &&
      row.data.receiptImports?.some(
        (saved) =>
          saved.importId === parsed.data.importId ||
          saved.fingerprint === parsed.data.fingerprint,
      )
    )
      return Response.json({
        data: row.data,
        version: row.version,
        notice: "Receipt already imported. No additional expense was saved.",
      });
  }
  if (!row || payload?.version !== row.version)
    return Response.json(
      {
        error:
          "Your ledger changed in another tab. Reload before saving again.",
      },
      { status: 409 },
    );
  let data;
  try {
    data = mutateLedger(row.data, payload);
  } catch (error) {
    logServerError(
      { method: "POST", path: "/api/ledger", stage: "mutate ledger" },
      error,
    );
    return Response.json(
      {
        error:
          error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "Check the receipt fields and amounts.",
      },
      { status: 400 },
    );
  }
  let saved;
  try {
    saved = await saveLedgerImages(
      session.user.id,
      row.data,
      data,
      row.version,
      payload,
      image,
    );
  } catch (error) {
    logServerError(
      { method: "POST", path: "/api/ledger", stage: "save receipt image" },
      error,
    );
    const invalidImage = error instanceof Error && error.cause === 400;
    return Response.json(
      {
        error: invalidImage
          ? error.message
          : "Could not save the receipt image. Please retry, or save without the image.",
      },
      { status: invalidImage ? 400 : 503 },
    );
  }
  if (!saved)
    return Response.json(
      {
        error:
          "Your ledger changed in another tab. Reload before saving again.",
      },
      { status: 409 },
    );
  return Response.json({ data, version: row.version + 1 });
});
