import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { authPrivacyOptions } from "../src/lib/auth-privacy/auth-privacy.ts";
import { protectSessionAdapter } from "../src/lib/auth-privacy/protect-session-adapter.ts";

const secret = "test-auth-privacy-secret-at-least-32-characters";
const storage: Record<string, Record<string, unknown>[]> = { user: [], session: [], account: [], verification: [] };
const factory = protectSessionAdapter(memoryAdapter(storage));
const auth = betterAuth({
  ...authPrivacyOptions,
  secret,
  baseURL: "https://example.test",
  database: factory,
  // Test only: exercise actual cookie/session endpoints without Google network calls.
  emailAndPassword: { enabled: true },
  logger: { disabled: true },
  session: { ...authPrivacyOptions.session, updateAge: 0 },
});
const response = await auth.api.signUpEmail({
  body: { name: "Privacy test", email: "privacy@example.test", password: "test-password-123456", image: "https://example.test/photo.png" },
  headers: new Headers({ origin: "https://example.test", "user-agent": "Sensitive browser", "x-forwarded-for": "192.0.2.1" }),
  asResponse: true,
});
assert.equal(response.status, 200);
const result = await response.json();
const cookie = response.headers.get("set-cookie")!.split(";")[0];
assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
assert.match(response.headers.get("set-cookie")!, /Secure/i);
assert.equal(storage.user[0].image, null);
assert.notEqual(storage.session[0].token, result.token);
assert.match(storage.session[0].token as string, /^dompetara-session-v1:/);
assert.equal((storage.session[0].tokenHash as string).length, 64);
assert.equal(storage.session[0].ipAddress, null);
assert.equal(storage.session[0].userAgent, null);

const headers = new Headers({ cookie });
const session = await auth.api.getSession({ headers });
assert.equal(session?.user.email, "privacy@example.test");
assert.equal(session?.session.token, result.token);
assert.equal("tokenHash" in session!.session, false);
const sessions = await auth.api.listSessions({ headers });
assert.equal(sessions[0].token, result.token);
assert.equal("tokenHash" in sessions[0], false);

// Database records, ciphertext and lookup digests must not be bearer credentials.
const adapter = factory({ ...authPrivacyOptions, secret });
for (const token of [storage.session[0].token, storage.session[0].tokenHash]) {
  assert.equal(await adapter.findOne({ model: "session", where: [{ field: "token", value: token as string }] }), null);
}
const context = await auth.$context;
await context.internalAdapter.updateSession(result.token, { expiresAt: new Date(Date.now() + 86400000), ipAddress: "192.0.2.2", userAgent: "New browser" });
assert.equal((await auth.api.getSession({ headers }))?.user.id, result.user.id);
assert.equal(storage.session[0].ipAddress, null);
assert.equal(storage.session[0].userAgent, null);

await context.internalAdapter.updateUser(result.user.id, { image: "https://example.test/new-photo.png" });
assert.equal(storage.user[0].image, null);
const googleAccount = await context.internalAdapter.createAccount({
  userId: result.user.id, providerId: "google", accountId: "google-subject",
  accessToken: "sensitive-access-token", refreshToken: "sensitive-refresh-token", idToken: "sensitive-id-token",
  accessTokenExpiresAt: new Date(), refreshTokenExpiresAt: new Date(), scope: "openid email profile",
});
await context.internalAdapter.updateAccount(googleAccount.id, { accessToken: "new-sensitive-token", idToken: "new-sensitive-id-token" });
const savedGoogle = storage.account.find((account) => account.providerId === "google")!;
for (const field of ["accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope"]) assert.equal(savedGoogle[field], null);
assert.equal(savedGoogle.accountId, "google-subject");

// Session revocation and transaction adapters use the same protected lookup.
const second = await context.internalAdapter.createSession(result.user.id);
assert.notEqual(storage.session.find((row) => row.id === second.id)!.token, second.token);
await auth.api.revokeSession({ headers, body: { token: second.token } });
assert.equal(storage.session.some((row) => row.id === second.id), false);
await adapter.transaction(async (transaction) => {
  const found = await transaction.findOne<{ token: string }>({ model: "session", where: [{ field: "token", value: result.token }] });
  assert.equal(found?.token, result.token);
});

// Corruption and incorrect keys fail closed; neither falls back to plaintext.
const storedToken = storage.session[0].token;
storage.session[0].token = "legacy-plaintext";
await assert.rejects(adapter.findOne({ model: "session", where: [{ field: "token", value: result.token }] }), /Unprotected session/);
storage.session[0].token = storedToken;
const wrongKeyAdapter = factory({ ...authPrivacyOptions, secret: "different-secret-at-least-32-characters" });
await assert.rejects(wrongKeyAdapter.findOne({ model: "session", where: [{ field: "token", value: result.token }] }));
await auth.api.signOut({ headers });
assert.equal(storage.session.length, 0);
assert.equal(await auth.api.getSession({ headers }), null);
console.log("Auth privacy checks passed: minimization, encrypted sessions, lookup, renewal, listing, revocation, transactions, and fail-closed reads.");
