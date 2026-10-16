import "server-only";
import { auth } from "@/lib/auth";
import { readLimitedBody } from "@/lib/read-limited-body";
import { logServerError } from "@/lib/log-server-error";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";
import { readLedger } from "../read-ledger";
import { saveLedger } from "../save-ledger";
import { ledgerMutationSchema, LedgerMutationError } from "../mutation";

export async function ledgerRequest(request: Request) {
  if (request.method === "POST" && request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL || request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (request.method === "GET") return Response.json(await readLedger(session.user.id), { headers: { "Cache-Control": "no-store" } });
  await enforceUserLimit(session.user.id, "ledger-write");
  let payload;
  try {
    payload = ledgerMutationSchema.parse(JSON.parse((await readLimitedBody(request.body, 300000)).toString("utf8")));
  } catch (error) {
    logServerError({ method: "POST", path: "/api/ledger", stage: "parse request" }, error);
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const saved = await saveLedger(session.user.id, payload, payload.version);
    if (!saved) return Response.json({ error: "Your ledger changed in another tab. Reload before saving again." }, { status: 409 });
    return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError({ method: "POST", path: "/api/ledger", stage: error instanceof LedgerMutationError ? "mutate ledger" : "save ledger" }, error instanceof LedgerMutationError ? error.cause : error);
    return Response.json({ error: error instanceof LedgerMutationError ? error.message : "Could not save. Please try again." }, { status: error instanceof LedgerMutationError ? 400 : 503 });
  }
}
