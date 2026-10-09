import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashLimitKey } from "../src/lib/security/hash-limit-key.ts";

const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
const origin = process.env.SECURITY_TEST_URL;
const secret = process.env.BETTER_AUTH_SECRET;
assert.ok(databaseUrl && origin && secret, "Set SECURITY_TEST_DATABASE_URL, SECURITY_TEST_URL and the isolated app's BETTER_AUTH_SECRET.");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname), "Only an isolated local database is allowed.");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Only a local application is allowed.");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const account = randomUUID(), token = randomUUID();
const signature = createHmac("sha256", secret).update(token).digest("base64");
const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
const headers = { Cookie: cookie, Origin: origin, "Content-Type": "application/json" };
const usedKeys = new Set();
let renamed = false;
async function exhaust(key, windowMs, count) {
  const hash = hashLimitKey(`${key}\0window:${windowMs}`, process.env.SECURITY_LIMITER_SECRET || secret);
  usedKeys.add(hash);
  // Long enough for assertions even if the DB crosses a UTC minute boundary.
  await pool.query(`INSERT INTO security_limit_buckets (key_hash,count,window_started_at,expires_at)
    VALUES ($1,$2,to_timestamp(floor(extract(epoch FROM clock_timestamp())*1000/$3)*$3/1000),
    to_timestamp((floor(extract(epoch FROM clock_timestamp())*1000/$3)+1)*$3/1000))
    ON CONFLICT (key_hash) DO UPDATE SET count=EXCLUDED.count,window_started_at=EXCLUDED.window_started_at,expires_at=EXCLUDED.expires_at`, [hash, count, windowMs]);
}
async function limitResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error, status === 429 ? "Too many requests. Please wait a moment and try again." : "Request protection is temporarily unavailable. Please try again later.");
}
try {
  await pool.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [account, "Security API fixture", `${account}@example.invalid`]);
  await pool.query("INSERT INTO session (id,user_id,token,expires_at,updated_at) VALUES ($1,$2,$3,$4,now())", [randomUUID(), account, token, new Date(Date.now()+3_600_000)]);
  assert.equal((await fetch(`${origin}/api/ledger`)).status, 401);
  let state = await (await fetch(`${origin}/api/ledger`, { headers })).json();
  let response = await fetch(`${origin}/api/ledger`, { method: "POST", headers, body: JSON.stringify({ action: "wallet", name: "Isolated wallet", currency: "IDR", amount: "10", version: state.version }) });
  assert.equal(response.status, 200);
  state = await response.json();
  assert.equal(state.data.wallets.length, 1);
  const persisted = await (await fetch(`${origin}/api/ledger`, { headers })).json();
  assert.deepEqual(persisted, { data: state.data, version: state.version });
  assert.equal((await fetch(`${origin}/api/ledger`, { method: "POST", headers: { ...headers, Origin: "https://invalid.example" }, body: "{}" })).status, 403);
  await exhaust(`api:ledger-write:user:${account}`, 60_000, 30);
  await limitResponse(await fetch(`${origin}/api/ledger`, { method: "POST", headers, body: "{}" }), 429);
  const before = await pool.query("SELECT data,version FROM ledger WHERE user_id=$1", [account]);
  assert.deepEqual(before.rows[0], { data: state.data, version: state.version });
  await exhaust(`api:ledger-read:user:${account}`, 60_000, 120);
  await limitResponse(await fetch(`${origin}/api/ledger`, { headers }), 429);
  // Missing multipart fields are rejected before scarce daily receipt admission.
  const form = new FormData();
  form.set("method", "ocr");
  const invalid = await fetch(`${origin}/api/receipts/extract`, { method: "POST", headers: { Cookie: cookie, Origin: origin }, body: form });
  assert.equal(invalid.status, 400);
  const dayHash = hashLimitKey(`receipt:user:${account}:day\0window:86400000`, process.env.SECURITY_LIMITER_SECRET || secret);
  assert.equal((await pool.query("SELECT 1 FROM security_limit_buckets WHERE key_hash=$1", [dayHash])).rowCount, 0);
  // Intake protection is before parsing, independent of provider configuration.
  await exhaust(`api:receipt-intake:user:${account}`, 60_000, 10);
  await limitResponse(await fetch(`${origin}/api/receipts/extract`, { method: "POST", headers, body: "not multipart" }), 429);
  // Exact Better Auth endpoint policy must use the shared store.
  const ip = "198.51.100.42";
  await exhaust(`auth:ip:${ip}`, 60_000, 100);
  const authDenied = await fetch(`${origin}/api/auth/get-session`, { headers: { Cookie: cookie, "x-vercel-forwarded-for": ip } });
  assert.equal(authDenied.status, 429);
  assert.ok(Number(authDenied.headers.get("Retry-After")) > 0);
  assert.equal(authDenied.headers.get("Cache-Control"), "no-store");
  // Local schema fault verifies no work proceeds when protection is unavailable.
  await pool.query('ALTER TABLE security_limit_buckets RENAME TO security_limit_buckets_fault_fixture');
  renamed = true;
  await limitResponse(await fetch(`${origin}/api/ledger`, { headers }), 503);
  await limitResponse(await fetch(`${origin}/api/auth/get-session`, { headers: { Cookie: cookie, "x-vercel-forwarded-for": "198.51.100.43" } }), 503);
  console.log("Security API checks passed: authenticated persistence, origin checks, shared quota responses, malformed intake, auth policy and unavailable-store fail-closed responses. Local only; no provider calls or load test.");
} finally {
  if (renamed) await pool.query('ALTER TABLE security_limit_buckets_fault_fixture RENAME TO security_limit_buckets');
  await pool.query('DELETE FROM "user" WHERE id=$1', [account]);
  if (usedKeys.size) await pool.query("DELETE FROM security_limit_buckets WHERE key_hash=ANY($1::text[])", [[...usedKeys]]);
  await pool.end();
}
