import assert from "node:assert/strict";
import { logServerError } from "../src/lib/log-server-error.ts";
import { withApiErrorLogging } from "../src/lib/with-api-error-logging.ts";
import { logAuthError } from "../src/lib/log-auth-error.ts";

const original = console.error;
const logs: { method?: string; path?: string; status?: number; message: string; stack?: string }[] = [];
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
    assert.equal(result, response);
    assert.deepEqual(await result.json(), { error: "Test failure" });
    assert.deepEqual(logs.at(-1), {
      method: "POST", path: "/api/test", status, name: "Error", message: "Test failure",
    });
  }
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
console.log("API error logging checks passed: failure statuses, exceptions, response preservation, auth errors and secret redaction.");
