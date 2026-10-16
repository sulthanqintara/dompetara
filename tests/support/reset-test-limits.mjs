import { hashLimitKey } from "../../src/lib/security/hash-limit-key.ts";

// Reset only this disposable account's budgets; global and other-user counters stay intact.
export async function resetTestLimits(sql, userId) {
  const secret = process.env.SECURITY_LIMITER_SECRET || process.env.BETTER_AUTH_SECRET;
  const scopes = ["ledger-read", "ledger-write", "preferences", "exchange-rates", "receipt-intake"];
  const keys = scopes.map((scope) => hashLimitKey(`api:${scope}:user:${userId}\0window:60000`, secret));
  await sql`delete from public.security_limit_buckets where key_hash in ${sql(keys)}`;
}
