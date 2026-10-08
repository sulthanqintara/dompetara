import { localeSchema } from "@/features/i18n/i18n";
import { readLedger } from "@/features/ledger/read-ledger";
import { readLimitedBody } from "@/lib/read-limited-body";
import { auth } from "@/lib/auth";
import { extractReceipt } from "./extract";
import { logServerError } from "@/lib/log-server-error";

// ponytail: process-local limits; use a shared limiter before running multiple instances.
const attempts = new Map<
  string,
  { since: number; count: number; busy: boolean }
>();
export async function extractRequest(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  const now = Date.now();
  for (const [id, attempt] of attempts)
    if (!attempt.busy && now - attempt.since > 60000) attempts.delete(id);
  const attempt = attempts.get(session.user.id) ?? {
    since: now,
    count: 0,
    busy: false,
  };
  if (attempt.busy || attempt.count >= 5)
    return Response.json(
      { error: "Please wait before reading another receipt." },
      { status: 429 },
    );
  attempts.set(session.user.id, attempt);
  attempt.count++;
  attempt.busy = true;
  try {
    const body = await readLimitedBody(request.body, 4_100_000);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      body: new Uint8Array(body),
    }).formData();
    const file = form.get("image"),
      method = form.get("method");
    if (!(file instanceof File) || (method !== "ocr" && method !== "ai"))
      throw new Error("Choose an image and OCR or AI.");
    const locale = localeSchema.parse(form.get("locale") ?? "en");
    const key = process.env.ZAI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if ((method === "ocr" && !key) || (method === "ai" && !key && !openaiKey))
      return Response.json(
        {
          error:
            method === "ocr"
              ? "Receipt OCR needs ZAI_API_KEY on the server. Add it and restart the app."
              : "AI receipt reading needs ZAI_API_KEY or OPENAI_API_KEY on the server.",
        },
        { status: 503 },
      );
    const { data } = await readLedger(session.user.id);
    const categories = data.categories
      .filter((category) => category.kind === "expense")
      .map((category) => category.name);
    return Response.json(
      await extractReceipt(file, method, key, categories, data.wallets, openaiKey, locale),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logServerError({ method: "POST", path: "/api/receipts/extract", stage: "extract receipt" }, error);
    return Response.json(
      {
        error:
          error instanceof Error &&
          !["ZodError", "SyntaxError"].includes(error.name)
            ? error.message
            : "The service returned unreadable receipt details. Try another image or enter the transaction manually.",
      },
      { status: 400 },
    );
  } finally {
    attempt.busy = false;
  }
}
