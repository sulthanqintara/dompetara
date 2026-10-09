import assert from "node:assert/strict";
import { logServerError } from "../src/lib/log-server-error.ts";
import { withApiErrorLogging } from "../src/lib/with-api-error-logging.ts";
import { logAuthError } from "../src/lib/log-auth-error.ts";
import { RequestLimitError } from "../src/lib/security/request-limit-error.ts";

const original = console.error;
const logs: { method?: string; path?: string; status?: number; stage?: string; name?: string; message: string; stack?: string }[] = [];
const oldKey = process.env.OPENAI_API_KEY;
try {
  console.error = (_label, entry) => logs.push(entry);
  process.env.OPENAI_API_KEY = "test-secret-openai-key";
  const request = new Request("https://ledger.example/api/test?token=private-query", {
    method: "POST",
    headers: { Authorization: "Bearer private-header" },
    body: "private-ledger-body",
  });
  for (const status of [400, 401, 403, 409, 429, 500, 503]) {
    const response = Response.json({ error: "Test failure" }, { status });
    const result = await withApiErrorLogging(async () => response)(request);
    if (status !== 429) assert.equal(result, response);
    else assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await result.json(), { error: "Test failure" });
    assert.deepEqual(logs.at(-1), {
      method: "POST", path: "/api/test", status, name: "Error", message: "Test failure",
    });
  }
  const authLimited = await withApiErrorLogging(async () => Response.json({ message: "Too many requests. Please try again later." }, {
    status: 429, headers: { "X-Retry-After": "12", "X-Auth-Test": "preserved" },
  }))(request);
  assert.equal(authLimited.headers.get("Retry-After"), "12");
  assert.equal(authLimited.headers.get("Cache-Control"), "no-store");
  assert.equal(authLimited.headers.get("X-Auth-Test"), "preserved");
  assert.deepEqual(await authLimited.json(), { message: "Too many requests. Please try again later." });
  const count = logs.length;
  await withApiErrorLogging(async () => Response.json({ ok: true }))(request);
  await withApiErrorLogging(async () => Response.redirect("https://ledger.example/sign-in"))(request);
  assert.equal(logs.length, count, "Successes and redirects are not failures");
  await withApiErrorLogging(async () => Response.json({ message: "Auth failure", code: "INVALID" }, { status: 401 }))(request);
  assert.equal(logs.at(-1)?.message, "Auth failure");
  const error = new Error("Database unavailable");
  await assert.rejects(withApiErrorLogging(async () => { throw error; })(request), (caught) => caught === error);
  assert.equal(logs.at(-1)?.message, "Database unavailable");
  assert.equal(logs.at(-1)?.status, 500);
  assert.match(logs.at(-1)?.stack ?? "", /api-error-logging.test.ts/);
  for (const [status, retryAfterSeconds, message] of [
    [429, 45, "Too many requests. Please wait a moment and try again."],
    [503, 60, "Request protection is temporarily unavailable. Please try again later."],
  ] as const) {
    const previousCount = logs.length;
    const response = await withApiErrorLogging(async () => {
      throw new RequestLimitError(status, retryAfterSeconds);
    })(request);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Retry-After"), String(retryAfterSeconds));
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { error: message });
    assert.equal(logs.length, previousCount + 1, "Typed admission failure is logged once");
    assert.equal(logs.at(-1)?.method, "POST");
    assert.equal(logs.at(-1)?.path, "/api/test");
    assert.equal(logs.at(-1)?.status, status);
    assert.equal(logs.at(-1)?.stage, "request admission");
    assert.equal(logs.at(-1)?.name, "RequestLimitError");
    assert.equal(logs.at(-1)?.message, message);
  }
  logServerError({ stage: "provider" }, new Error("Rejected test-secret-openai-key with Bearer private-token"));
  assert.equal(logs.at(-1)?.message, "Rejected [redacted] with Bearer [redacted]");
  logServerError({ stage: "database" }, new Error("Failed query\nparams: private-ledger-values"));
  assert.equal(logs.at(-1)?.message, "Failed query\nparams: [redacted]");
  logServerError({ stage: "database" }, new Error("Database request failed", { cause: new Error("Connection refused") }));
  assert.match(logs.at(-1)?.message ?? "", /Connection refused/);
  logServerError({ stage: "parse" }, new SyntaxError('Unexpected token, "private-ledger-body" is not valid JSON'));
  assert.equal(logs.at(-1)?.message, "Invalid JSON or syntax.");
  const poolFailure = new Error("Failed query\nparams: private-session-token", { cause: new Error("EMAXCONNSESSION pool_size: 15") });
  logAuthError("error", "INTERNAL_SERVER_ERROR", poolFailure, { token: "private-session-token" });
  assert.match(logs.at(-1)?.message ?? "", /EMAXCONNSESSION/);
  assert.doesNotMatch(JSON.stringify(logs.at(-1)), /private-session-token/);
  const authCount = logs.length;
  logAuthError("info", "Ignored diagnostic", { token: "private-session-token" });
  assert.equal(logs.length, authCount);
  assert.doesNotMatch(JSON.stringify(logs), /private-query|private-header|private-ledger-body|private-ledger-values|test-secret-openai-key|private-token/);
} finally {
  console.error = original;
  if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = oldKey;
}
console.log("API error logging checks passed: failure statuses, exceptions, typed admission responses/retry headers, response preservation, auth errors and secret redaction.");
