import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDatabaseSecurityStore } from "../src/lib/security/create-database-security-store.ts";
import { createSecurityLimiter } from "../src/lib/security/create-security-limiter.ts";

// Explicit opt-in only. Never fall back to DATABASE_URL or cloud credentials.
const connectionString = process.env.SECURITY_TEST_DATABASE_URL;
assert.ok(connectionString, "Set SECURITY_TEST_DATABASE_URL to an isolated local PostgreSQL test instance.");
const url = new URL(connectionString);
assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Security DB tests accept localhost only.");
assert.equal(url.search, "", "Supply test connection without search_path/options overrides.");
const schema = `security_test_${randomUUID().replaceAll("-", "")}`;
const control = new Pool({ connectionString, max: 1 });
const pools = Array.from({ length: 3 }, () => new Pool({ connectionString, max: 2, options: `-c search_path=${schema}` }));
const secret = `isolated-security-tests-${randomUUID()}`;
const limiters = pools.map((pool) => createSecurityLimiter(createDatabaseSecurityStore(drizzle(pool)), secret));
const config = { globalDailyLimit: 100, globalConcurrency: 3 };

try {
  await control.query(`CREATE SCHEMA "${schema}"`);
  const migration = await readFile(new URL("../drizzle/0006_security_controls.sql", import.meta.url), "utf8");
  // DDL is confined to our new schema. Supabase roles need not exist locally;
  // the production migration's exact revoke is covered by the policy test.
  const fixtureDdl = migration.replace(/REVOKE ALL PRIVILEGES ON TABLE public\.security_limit_buckets, public\.security_admission_leases FROM anon, authenticated;/, "REVOKE ALL PRIVILEGES ON TABLE security_limit_buckets, security_admission_leases FROM PUBLIC;");
  await pools[0].query(fixtureDdl);
  const rls = await control.query("SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = $1::regnamespace AND relkind = 'r'", [schema]);
  assert.equal(rls.rows.length, 2);
  assert.ok(rls.rows.every((row) => row.relrowsecurity));

  // Independent pools/limiter factories model different server processes.
  {
    const decisions = await Promise.all(Array.from({ length: 18 }, (_, i) => limiters[i % 3].consumeLimits([
      { key: "same-user", windowMs: 86_400_000, max: 5 },
      { key: "same-global", windowMs: 86_400_000, max: 12 },
    ])));
    assert.equal(decisions.filter((decision) => decision.allowed).length, 5, "Concurrent first insert permits exactly the shared user maximum");
    const { rows } = await pools[0].query("SELECT key_hash, count FROM security_limit_buckets");
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.count === 5), "Denied requests consume no partial global budget");
    assert.ok(rows.every((row) => /^[a-f0-9]{64}$/.test(row.key_hash)), "Only HMAC keys are stored");
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    const decisions = await Promise.all(Array.from({ length: 12 }, (_, i) => limiters[i % 3].consumeLimits([
      { key: `distinct-path-${i}`, windowMs: 86_400_000, max: 1 },
      { key: "shared-global", windowMs: 86_400_000, max: 3 },
    ])));
    assert.equal(decisions.filter((decision) => decision.allowed).length, 3);
    const count = await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets");
    assert.equal(count.rows[0].total, 4, "Global denial creates no attacker-selected extra buckets");
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    const rules = [{ key: "order-a", windowMs: 86_400_000, max: 30 }, { key: "order-b", windowMs: 86_400_000, max: 30 }];
    const decisions = await Promise.all(Array.from({ length: 12 }, (_, i) => limiters[i % 3].consumeLimits(i % 2 ? rules : [...rules].reverse())));
    assert.ok(decisions.every((decision) => decision.allowed), "Opposite rule order does not deadlock");
    assert.ok((await pools[0].query("SELECT count FROM security_limit_buckets")).rows.every((row) => row.count === 12));
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    const admissions = await Promise.all(Array.from({ length: 6 }, (_, i) => limiters[i % 3].acquireReceiptAdmission(`receipt-user-${i}`, config)));
    assert.equal(admissions.filter((admission) => admission.allowed).length, 3, "Global concurrency admits three across pools");
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 6);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets")).rows[0].total, 7);
    for (const admission of admissions) if (admission.allowed) await admission.release();
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 0);
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    const admissions = await Promise.all(Array.from({ length: 6 }, (_, i) => limiters[i % 3].acquireReceiptAdmission("same-receipt-user", config)));
    assert.equal(admissions.filter((admission) => admission.allowed).length, 1, "Per-user concurrency admits one across pools");
    const first = admissions.find((admission) => admission.allowed)!;
    assert.ok(first.allowed);
    await pools[0].query("UPDATE security_admission_leases SET expires_at = clock_timestamp() - interval '1 second'");
    const second = await limiters[1].acquireReceiptAdmission("same-receipt-user", config);
    assert.ok(second.allowed, "Expired leases recover after a crashed worker");
    await first.release();
    await first.release();
    assert.equal((await limiters[2].acquireReceiptAdmission("same-receipt-user", config)).allowed, false, "Late release cannot remove newer admission");
    await second.release();
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    const cap = { ...config, globalDailyLimit: 1 };
    const admission = await limiters[0].acquireReceiptAdmission("first-user", cap);
    assert.ok(admission.allowed);
    await admission.release();
    const before = await pools[0].query("SELECT key_hash, count FROM security_limit_buckets ORDER BY key_hash");
    assert.equal((await limiters[1].acquireReceiptAdmission("new-user", cap)).allowed, false);
    assert.deepEqual((await pools[0].query("SELECT key_hash, count FROM security_limit_buckets ORDER BY key_hash")).rows, before.rows);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 0);
  }
  await pools[0].query("TRUNCATE security_limit_buckets, security_admission_leases");
  {
    assert.equal((await limiters[0].acquireReceiptAdmission("disabled", { ...config, globalDailyLimit: 0 })).allowed, false);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets")).rows[0].total, 0);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 0);
  }
  {
    for (let i = 0; i < 80; i++) {
      const key = createHash("sha256").update(`expired-fixture-${i}`).digest("hex");
      await pools[0].query("INSERT INTO security_limit_buckets VALUES ($1, 1, clock_timestamp() - interval '2 days', clock_timestamp() - interval '1 day')", [key]);
      await pools[0].query("INSERT INTO security_admission_leases VALUES ($1, $2, clock_timestamp() - interval '1 day')", [key, randomUUID()]);
    }
    const held = await pools[2].connect();
    try {
      await held.query("BEGIN");
      const locked = await held.query("SELECT key_hash FROM security_limit_buckets ORDER BY expires_at LIMIT 1 FOR UPDATE");
      const decision = await limiters[0].consumeLimits([{ key: "cleanup", windowMs: 86_400_000, max: 5 }]);
      assert.ok(decision.allowed, "Cleanup skips an expired bucket locked by another transaction");
      assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets")).rows[0].total, 17, "Cleanup removes at most 64 expired buckets");
      assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 16, "Cleanup removes at most 64 expired lease rows");
      assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets WHERE key_hash = $1", [locked.rows[0].key_hash])).rows[0].total, 1);
    } finally {
      await held.query("ROLLBACK");
      held.release();
    }
    await limiters[1].consumeLimits([{ key: "cleanup", windowMs: 86_400_000, max: 5 }]);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_limit_buckets")).rows[0].total, 1);
    assert.equal((await pools[0].query("SELECT count(*)::integer AS total FROM security_admission_leases")).rows[0].total, 0);
  }
  console.log("Isolated PostgreSQL security checks passed: cross-pool atomic limits, insertion races, all-or-none quotas, stable lock order, shared concurrency, lease expiry/release, bounded cleanup and RLS.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await control.end();
}
