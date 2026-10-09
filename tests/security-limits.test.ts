import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSecurityLimiter } from "../src/lib/security/create-security-limiter.ts";
import { evaluateAdmission } from "../src/lib/security/evaluate-admission.ts";
import { hashLimitKey } from "../src/lib/security/hash-limit-key.ts";
import { readReceiptLimitsConfig } from "../src/lib/security/read-receipt-limits-config.ts";
import type { AdmissionLease, LimitBucket, SecurityLimitStore } from "../src/lib/security/security-limits.ts";

const secret = "offline-security-test-secret-32-characters";
const config = { globalDailyLimit: 100, globalConcurrency: 3 };

function fixture() {
  let now = 86_400_000 + 1000;
  const buckets = new Map<string, LimitBucket>();
  const leases = new Map<string, (AdmissionLease & { token: string })[]>();
  const store: SecurityLimitStore = {
    async consume(request) {
      // Evaluation/commit is synchronous here, matching the store's atomic
      // contract. PostgreSQL concurrency is covered separately by the DB test.
      const decision = evaluateAdmission(request, [...buckets.values()], [...leases.values()].flat(), now);
      if (!decision.allowed) return decision;
      for (const rule of request.rules) {
        const start = Math.floor(now / rule.windowMs) * rule.windowMs;
        const previous = buckets.get(rule.keyHash);
        buckets.set(rule.keyHash, { keyHash: rule.keyHash, count: (previous?.windowStartedAt === start ? previous.count : 0) + 1, windowStartedAt: start });
      }
      if (request.lease) leases.set(request.lease.token, request.lease.rules.map((rule) => ({ token: request.lease!.token, scopeHash: rule.scopeHash, expiresAt: now + request.lease!.ttlMs })));
      return decision;
    },
    async release(token) { leases.delete(token); },
  };
  return { limiter: createSecurityLimiter(store, secret), buckets, leases, advance(ms: number) { now += ms; } };
}

assert.deepEqual(readReceiptLimitsConfig({}), config);
assert.deepEqual(readReceiptLimitsConfig({ RECEIPT_GLOBAL_DAILY_LIMIT: "0", RECEIPT_GLOBAL_CONCURRENCY: "0" }), { globalDailyLimit: 0, globalConcurrency: 0 });
for (const value of ["", "-1", "3.5", "Infinity", "1000001", "03", " 3", "not-a-number"])
  assert.throws(() => readReceiptLimitsConfig({ RECEIPT_GLOBAL_DAILY_LIMIT: value }), /configuration is invalid/);
assert.throws(() => readReceiptLimitsConfig({ RECEIPT_GLOBAL_CONCURRENCY: "101" }), /configuration is invalid/);
assert.throws(() => hashLimitKey("user", "short"), /configuration is invalid/);
assert.notEqual(hashLimitKey("private-user", secret), hashLimitKey("private-user", `${secret}changed`));
assert.match(hashLimitKey("private-user", secret), /^[a-f0-9]{64}$/);

{
  const f = fixture();
  const decisions = await Promise.all(Array.from({ length: 12 }, () => f.limiter.consumeLimits([{ key: "user:private-user", windowMs: 60_000, max: 5 }])));
  assert.equal(decisions.filter((result) => result.allowed).length, 5);
  assert.equal(decisions.at(-1)?.retryAfterSeconds, 59);
  assert.equal([...f.buckets.values()][0].count, 5);
  assert.doesNotMatch(JSON.stringify([...f.buckets]), /private-user/);
  f.advance(59_000);
  assert.equal((await f.limiter.consumeLimits([{ key: "user:private-user", windowMs: 60_000, max: 5 }])).allowed, true);
  assert.equal([...f.buckets.values()][0].count, 1);
  assert.throws(() => f.limiter.consumeLimits([{ key: "duplicate", windowMs: 60_000, max: 1 }, { key: "duplicate", windowMs: 60_000, max: 2 }]), /Duplicate/);
}
{
  const f = fixture();
  const global = { key: "global", windowMs: 60_000, max: 1 };
  assert.equal((await f.limiter.consumeLimits([global])).allowed, true);
  const before = JSON.stringify([...f.buckets]);
  assert.equal((await f.limiter.consumeLimits([{ key: "new-user", windowMs: 60_000, max: 5 }, global])).allowed, false);
  assert.equal(JSON.stringify([...f.buckets]), before, "Denied multi-budget request creates no new bucket and consumes no partial quota");
}
{
  const f = fixture();
  const pending = await Promise.all(["user-a", "user-b", "user-c", "user-d"].map((id) => f.limiter.acquireReceiptAdmission(id, config)));
  assert.equal(pending.filter((result) => result.allowed).length, 3);
  assert.equal(f.buckets.size, 7, "Denied fourth user creates no user buckets");
  const counts = JSON.stringify([...f.buckets]);
  assert.equal((await f.limiter.acquireReceiptAdmission("user-a", config)).allowed, false, "Per-user concurrency is shared");
  assert.equal(JSON.stringify([...f.buckets]), counts, "Busy admissions consume no daily/minute budget");
  const first = pending[0];
  assert.ok(first.allowed);
  await first.release();
  await first.release();
  const admitted = await f.limiter.acquireReceiptAdmission("user-d", config);
  assert.ok(admitted.allowed);
  f.advance(90_000);
  const afterExpiry = await f.limiter.acquireReceiptAdmission("user-d", config);
  assert.ok(afterExpiry.allowed, "Expired leases permit work after a crashed worker");
  await admitted.release();
  assert.equal((await f.limiter.acquireReceiptAdmission("user-d", config)).allowed, false, "Late release cannot remove a newer token's lease");
  await afterExpiry.release();
}
{
  const f = fixture();
  for (let i = 0; i < 30; i++) {
    if (i && i % 5 === 0) f.advance(60_000);
    const admission = await f.limiter.acquireReceiptAdmission("daily-user", config);
    assert.ok(admission.allowed);
    await admission.release();
  }
  f.advance(60_000);
  assert.equal((await f.limiter.acquireReceiptAdmission("daily-user", config)).allowed, false, "User daily cap persists beyond minute windows");
  f.advance(86_400_000);
  assert.equal((await f.limiter.acquireReceiptAdmission("daily-user", config)).allowed, true);
}
{
  const f = fixture();
  const cap = { ...config, globalDailyLimit: 1 };
  const first = await f.limiter.acquireReceiptAdmission("user-a", cap);
  assert.ok(first.allowed);
  await first.release();
  const before = JSON.stringify([...f.buckets]);
  assert.equal((await f.limiter.acquireReceiptAdmission("new-user", cap)).allowed, false);
  assert.equal(JSON.stringify([...f.buckets]), before);
  for (const disabled of [{ ...config, globalDailyLimit: 0 }, { ...config, globalConcurrency: 0 }]) {
    const empty = fixture();
    assert.equal((await empty.limiter.acquireReceiptAdmission("user", disabled)).allowed, false);
    assert.equal(empty.buckets.size, 0);
    assert.equal(empty.leases.size, 0);
  }
}
{
  const failing = createSecurityLimiter({ async consume() { throw new Error("Store unavailable"); }, async release() {} }, secret);
  await assert.rejects(failing.acquireReceiptAdmission("user", config), /Store unavailable/);
  await assert.rejects(failing.consumeLimits([{ key: "user", windowMs: 60_000, max: 1 }]), /Store unavailable/);
}
const migration = await readFile(new URL("../drizzle/0006_security_controls.sql", import.meta.url), "utf8");
assert.match(migration, /ALTER TABLE "security_limit_buckets" ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /ALTER TABLE "security_admission_leases" ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public.security_limit_buckets, public.security_admission_leases FROM anon, authenticated/);
console.log("Security limit checks passed: atomic budgets, private keys, fixed windows, daily and concurrency caps, expiry, fail-closed configuration and RLS migration.");
