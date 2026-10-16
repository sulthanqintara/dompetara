import "server-only";
import { auth } from "@/lib/auth";
import { readLedger } from "../read-ledger";
import { logServerError } from "@/lib/log-server-error";
import { RequestLimitError } from "@/lib/security/request-limit-error";

export async function exportRequest(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    return Response.json(await readLedger(session.user.id, undefined, true), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestLimitError) throw error;
    logServerError({ method: "GET", path: "/api/ledger/export", status: 503, stage: "export ledger" }, error);
    return Response.json({ error: "Could not export your ledger. Please try again." }, { status: 503 });
  }
}
