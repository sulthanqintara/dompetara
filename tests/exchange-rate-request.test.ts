import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { currencies } from "../src/features/ledger/ledger.ts";
import { validRateDate } from "../src/features/exchange-rates/exchange-rates.ts";
import { withApiErrorLogging } from "../src/lib/with-api-error-logging.ts";
import { RequestLimitError } from "../src/lib/security/request-limit-error.ts";

const suggestion = { rate: "17800", rateDate: "2026-10-01", provider: "ecb", lastCheckedAt: "2026-10-01T00:00:00Z", stale: false };
let signedIn = true;
let cached: typeof suggestion | null = suggestion;
let cacheError: Error | undefined;
let limitError: Error | undefined;
const reads: unknown[][] = [], limits: unknown[][] = [], logs: unknown[][] = [];
const originalError = console.error;
const feature: { exchangeRateRequest?: (request: Request) => Promise<Response> } = {};
const route: { GET?: (request: Request) => Promise<Response> } = {};
const dependencies: Record<string, unknown> = {
  "server-only": {},
  "@/lib/auth": { auth: { api: { getSession: async () => signedIn ? { user: { id: "user" } } : null } } },
  "@/features/ledger/ledger": { currencies },
  "@/features/exchange-rates/exchange-rates": { validRateDate },
  "@/features/exchange-rates/server": { readCachedRate: async (...args: unknown[]) => { reads.push(args); if (cacheError) throw cacheError; return cached; } },
  "@/lib/security/enforce-user-limit": { enforceUserLimit: async (...args: unknown[]) => { limits.push(args); if (limitError) throw limitError; } },
  "@/lib/log-server-error": { logServerError: (...args: unknown[]) => logs.push(args) },
  "@/lib/with-api-error-logging": { withApiErrorLogging },
  "@/features/exchange-rates/exchange-rate-request": feature,
};
for (const [path, exports] of [
  ["src/features/exchange-rates/exchange-rate-request.ts", feature],
  ["src/app/api/exchange-rates/route.ts", route],
] as const) {
  const code = ts.transpileModule(await readFile(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, URL, Response, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
}
const request = (query = "from=USD&to=IDR&date=2026-10-01") => route.GET!(new Request(`https://ledger.example/api/exchange-rates?${query}`));
try {
  console.error = (...args: unknown[]) => logs.push(args);
  signedIn = false;
  assert.equal((await request()).status, 401);
  assert.equal(limits.length, 0);
  assert.equal(reads.length, 0);
  signedIn = true;
  for (const query of ["", "from=EUR&to=IDR&date=2026-10-01", "from=USD&to=EUR&date=2026-10-01", "from=USD&to=IDR&date=2026-02-30"]) {
    const response = await request(query);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Choose supported currencies and a valid date." });
  }
  assert.equal(reads.length, 0);
  const success = await request();
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await success.json(), { suggestion });
  assert.deepEqual(reads, [["USD", "IDR", "2026-10-01"]]);
  assert.ok(limits.every((args) => args[0] === "user" && args[1] === "exchange-rates"));
  cached = null;
  assert.deepEqual(await (await request()).json(), { suggestion: null });
  cacheError = new Error("Cache unavailable");
  const unavailable = await request();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { error: "Suggested rates unavailable. Manual entry is available." });
  assert.ok(logs.some(([context, error]) => (context as { stage?: string })?.stage === "read cached rate" && error === cacheError), "Log the original cache failure");
  const count = reads.length;
  limitError = new RequestLimitError(429, 45);
  const limited = await request();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "45");
  assert.equal(limited.headers.get("Cache-Control"), "no-store");
  assert.equal(reads.length, count);
} finally { console.error = originalError; }
console.log("Exchange-rate request checks passed: authentication, parameters, rate limits, cache/null responses, fallback and original-error logging.");
