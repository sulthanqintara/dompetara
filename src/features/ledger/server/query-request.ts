import "server-only";
import { auth } from "@/lib/auth";
import { logServerError } from "@/lib/log-server-error";
import { enforceUserLimit } from "@/lib/security/enforce-user-limit";
import { ledgerQuerySchema } from "../query";
import { readTransactionSearchParams } from "../transaction-filters";
import { readLedgerOverview } from "./read-ledger-overview";
import { readTransactions } from "./read-transactions";

export async function queryRequest(request: Request, type: "overview" | "transactions") {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  await enforceUserLimit(session.user.id, "ledger-read");
  const query = ledgerQuerySchema.safeParse(readTransactionSearchParams(new URL(request.url).searchParams));
  if (!query.success) {
    logServerError({ method: "GET", path: `/api/ledger/${type}`, status: 400, stage: "validate query" }, "Invalid ledger query.");
    return Response.json({ error: "Invalid ledger query." }, { status: 400 });
  }
  try {
    const result = type === "overview" ? await readLedgerOverview(session.user.id, query.data) : await readTransactions(session.user.id, query.data);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError({ method: "GET", path: `/api/ledger/${type}`, status: 503, stage: "query ledger" }, error);
    return Response.json({ error: "Could not load your ledger. Please try again." }, { status: 503 });
  }
}
