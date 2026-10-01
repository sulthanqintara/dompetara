import {
  refreshSnapshot,
  type RateSnapshot,
} from "../../../src/features/exchange-rates/exchange-rates.ts";

Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  const expected = Deno.env.get("FX_REFRESH_SECRET");
  const supplied = request.headers.get("x-refresh-secret");
  if (!expected || !supplied || supplied.length !== expected.length)
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  // WebCrypto verifies the shared token without a character-by-character comparison.
  const message = new TextEncoder().encode("refresh-exchange-rates");
  const expectedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(expected),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const suppliedKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(supplied),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", suppliedKey, message);
  if (!(await crypto.subtle.verify("HMAC", expectedKey, signature, message)))
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/rest/v1/exchange_rate_cache`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!key) throw new Error("Missing server database credentials.");
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const previousResponse = await fetch(
      `${url}?provider=eq.ecb&base_currency=eq.USD&order=rate_date.desc&limit=1`,
      { headers, signal: AbortSignal.timeout(10000) },
    );
    if (!previousResponse.ok) throw new Error("Could not read rate cache.");
    const [row] = await previousResponse.json();
    const previous: RateSnapshot | null = row
      ? {
          provider: "ecb",
          baseCurrency: "USD",
          rates: row.rates,
          rateDate: row.rate_date,
          etag: row.etag,
          lastCheckedAt: row.last_checked_at,
          expiresAt: row.expires_at,
        }
      : null;
    const result = await refreshSnapshot(previous);
    if (result.status !== "fresh") {
      const snapshot = result.snapshot;
      const saved = await fetch(
        `${url}?on_conflict=provider,base_currency,rate_date`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            provider: snapshot.provider,
            base_currency: snapshot.baseCurrency,
            rate_date: snapshot.rateDate,
            rates: snapshot.rates,
            etag: snapshot.etag,
            last_checked_at: snapshot.lastCheckedAt,
            expires_at: snapshot.expiresAt,
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!saved.ok) throw new Error("Could not save refreshed rates.");
    }
    return Response.json({
      status: result.status,
      rateDate: result.snapshot.rateDate,
    });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Rate refresh failed.",
    );
    return Response.json(
      { error: "Rate refresh failed; previous rates are retained." },
      { status: 502 },
    );
  }
});
