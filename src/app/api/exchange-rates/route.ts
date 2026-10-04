import { auth } from "@/lib/auth";
import { currencies, type Currency } from "@/features/ledger/ledger";
import { validRateDate } from "@/features/exchange-rates/exchange-rates";
import { readCachedRate } from "@/features/exchange-rates/server";
import { withApiErrorLogging } from "@/lib/with-api-error-logging";
import { logServerError } from "@/lib/log-server-error";

export const GET = withApiErrorLogging(async (request: Request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Please sign in." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const from = params.get("from") as Currency;
  const to = params.get("to") as Currency;
  const date = params.get("date");
  if (
    !currencies.includes(from) ||
    !currencies.includes(to) ||
    !validRateDate(date)
  )
    return Response.json(
      { error: "Choose supported currencies and a valid date." },
      { status: 400 },
    );
  try {
    return Response.json(
      { suggestion: await readCachedRate(from, to, date) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logServerError({ method: "GET", path: "/api/exchange-rates", stage: "read cached rate" }, error);
    return Response.json(
      { error: "Suggested rates unavailable. Manual entry is available." },
      { status: 503 },
    );
  }
});
