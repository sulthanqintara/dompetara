import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ledger } from "@/lib/db/schema";
import { emptyLedger, mutateLedger } from "@/features/ledger/ledger";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  await db
    .insert(ledger)
    .values({ userId: session.user.id, data: emptyLedger() })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(ledger)
    .where(eq(ledger.userId, session.user.id));
  return Response.json(
    { data: row.data, version: row.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || request.url).origin
  )
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  let payload;
  try {
    const body = await request.text();
    if (body.length > 16000) throw new Error();
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const [row] = await db
    .select()
    .from(ledger)
    .where(eq(ledger.userId, session.user.id));
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
  const updated = await db
    .update(ledger)
    .set({ data, version: row.version + 1 })
    .where(
      and(eq(ledger.userId, session.user.id), eq(ledger.version, row.version)),
    )
    .returning({ version: ledger.version });
  if (!updated.length)
    return Response.json(
      {
        error:
          "Your ledger changed in another tab. Reload before saving again.",
      },
      { status: 409 },
    );
  return Response.json({ data, version: updated[0].version });
}
