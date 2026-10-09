import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import * as schema from "../src/lib/db/schema/auth.ts";
import { authPrivacyOptions } from "../src/lib/auth-privacy/auth-privacy.ts";
import { protectSessionAdapter } from "../src/lib/auth-privacy/protect-session-adapter.ts";

const connectionString = process.env.AUTH_TEST_DATABASE_URL;
assert.ok(connectionString, "Set AUTH_TEST_DATABASE_URL to an isolated local PostgreSQL instance.");
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Auth DB tests accept localhost only.");
assert.equal(url.search, "");
const namespace = `auth_test_${randomUUID().replaceAll("-", "")}`;
const control = new Pool({ connectionString, max: 1 });
const pool = new Pool({ connectionString, max: 2, options: `-c search_path=${namespace}` });
try {
  await control.query(`CREATE SCHEMA "${namespace}"`);
  const initial = await readFile(new URL("../drizzle/0000_sloppy_the_stranger.sql", import.meta.url), "utf8");
  await pool.query(initial.replaceAll('"public".', ""));
  await pool.query('CREATE TABLE ledger (user_id text PRIMARY KEY REFERENCES "user"(id), data jsonb NOT NULL)');
  await pool.query(`INSERT INTO "user" (id,name,email,image) VALUES ('existing','Keep name','existing@example.test','https://example.test/photo')`);
  await pool.query(`INSERT INTO ledger (user_id,data) VALUES ('existing','{"balance":100}')`);
  await pool.query(`INSERT INTO account (id,user_id,account_id,provider_id,access_token,refresh_token,id_token,scope,updated_at) VALUES ('existing','existing','google-existing','google','access','refresh','id','profile',now())`);
  await pool.query(`INSERT INTO session (id,user_id,token,expires_at,updated_at,ip_address,user_agent) VALUES ('old','existing','plaintext',now()+interval '1 day',now(),'192.0.2.1','browser')`);
  await pool.query(`INSERT INTO verification (id,identifier,value,expires_at) VALUES ('old','state','verifier',now()+interval '10 minutes')`);
  await pool.query(await readFile(new URL("../drizzle/0007_auth_privacy.sql", import.meta.url), "utf8"));
  await pool.query(await readFile(new URL("../drizzle/0008_auth_privacy_guards.sql", import.meta.url), "utf8"));
  assert.deepEqual((await pool.query('SELECT name,email,image FROM "user"')).rows, [{ name: "Keep name", email: "existing@example.test", image: null }]);
  assert.deepEqual((await pool.query("SELECT data FROM ledger")).rows, [{ data: { balance: 100 } }]);
  assert.deepEqual((await pool.query("SELECT access_token,refresh_token,id_token,scope FROM account")).rows, [{ access_token: null, refresh_token: null, id_token: null, scope: null }]);
  assert.equal((await pool.query("SELECT * FROM session")).rowCount, 0);
  assert.equal((await pool.query("SELECT * FROM verification")).rowCount, 0);
  await assert.rejects(pool.query(`UPDATE "user" SET image='https://example.test/photo' WHERE id='existing'`), { code: "23514" });
  await assert.rejects(pool.query(`UPDATE account SET access_token='legacy-token' WHERE id='existing'`), { code: "23514" });
  await assert.rejects(pool.query(`INSERT INTO session (id,user_id,token,token_hash,expires_at,updated_at) VALUES ('unsafe','existing','plaintext',repeat('a',64),now()+interval '1 day',now())`), { code: "23514" });

  const auth = betterAuth({
    ...authPrivacyOptions,
    secret: "isolated-auth-db-test-secret-at-least-32-characters",
    baseURL: "https://example.test",
    database: protectSessionAdapter(drizzleAdapter(drizzle(pool, { schema }), { provider: "pg", transaction: true })),
    socialProviders: { google: { clientId: "test", clientSecret: "test", includeGrantedScopes: false } },
    logger: { disabled: true },
  });
  const context = await auth.$context;
  const provider = context.socialProviders.find((provider) => provider.id === "google")!;
  // Mock only Google's network boundary; exercise real social provisioning,
  // PostgreSQL adapter transactions, privacy hooks, and session cookies.
  provider.idToken = { verify: async () => true };
  provider.getUserInfo = async () => ({
    user: { name: "Google test", email: "google@example.test", emailVerified: true, image: "https://example.test/photo" },
    data: { sub: "google-test" },
  });
  const authorization = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "/" }, asResponse: true });
  assert.equal(authorization.status, 200);
  assert.match(authorization.headers.get("set-cookie")!, /oauth_state/);
  assert.equal((await pool.query("SELECT * FROM verification")).rowCount, 0, "OAuth state must not be persisted.");
  const authorizationBody = await authorization.json();
  const authorizationUrl = new URL(authorizationBody.url);
  const state = authorizationUrl.searchParams.get("state")!;
  const stateCookie = authorization.headers.get("set-cookie")!.split(";")[0];
  provider.validateAuthorizationCode = async () => ({
    accessToken: "mock-access-token", refreshToken: "mock-refresh-token", idToken: "mock-id-token",
    accessTokenExpiresAt: new Date(Date.now() + 3600000), scopes: ["openid", "email", "profile"],
  });
  const callback = await auth.handler(new Request(`https://example.test/api/auth/callback/google?code=test-code&state=${encodeURIComponent(state)}`, { headers: { cookie: stateCookie } }));
  assert.equal(callback.status, 302, "Redirect-based Google callback provisions a private session.");
  assert.equal(new URL(callback.headers.get("location")!, "https://example.test").pathname, "/");
  assert.equal((await pool.query("SELECT * FROM verification")).rowCount, 0);
  assert.equal((await pool.query("SELECT access_token FROM account WHERE account_id='google-test'")).rows[0].access_token, null);
  // Remove only this test callback session before the direct-login checks.
  await pool.query("DELETE FROM session");
  const login = async () => auth.api.signInSocial({
    body: { provider: "google", idToken: { token: "mock-id-token", accessToken: "mock-access-token", refreshToken: "mock-refresh-token" } },
    headers: new Headers({ "user-agent": "Sensitive browser" }), asResponse: true,
  });
  const response = await login();
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const headers = new Headers({ cookie });
  const session = await auth.api.getSession({ headers });
  assert.equal(session?.user.email, "google@example.test");
  const stored = (await pool.query("SELECT token,token_hash,ip_address,user_agent FROM session WHERE user_id=$1", [session!.user.id])).rows[0];
  assert.notEqual(stored.token, session!.session.token);
  assert.equal(stored.ip_address, null);
  assert.equal(stored.user_agent, null);
  const account = (await pool.query("SELECT access_token,refresh_token,id_token FROM account WHERE user_id=$1", [session!.user.id])).rows[0];
  assert.deepEqual(account, { access_token: null, refresh_token: null, id_token: null });
  assert.equal((await login()).status, 200, "Returning Google user can sign in without stored Google tokens.");
  assert.equal((await pool.query('SELECT * FROM "user" WHERE email=$1', ["google@example.test"])).rowCount, 1);
  assert.equal((await auth.api.listSessions({ headers })).length, 2);
  await auth.api.signOut({ headers });
  assert.equal(await auth.api.getSession({ headers }), null);
  console.log("Auth PostgreSQL checks passed: legacy cleanup preserves ledger/profile, encrypted social sessions, returning Google login, OAuth state minimization, listing and sign-out.");
} finally {
  await pool.end();
  await control.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await control.end();
}
