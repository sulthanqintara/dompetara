import assert from "node:assert/strict";
import { createRateCache } from "../src/features/exchange-rates/rate-cache.ts";
import type { RateSuggestion } from "../src/features/exchange-rates/exchange-rates.ts";

const suggestion: RateSuggestion = { rate: "16000", rateDate: "2026-10-08", provider: "ecb", lastCheckedAt: "2026-10-08T00:00:00Z", stale: false };
let calls = 0;
let clock = 0;
let resolve!: (value: RateSuggestion) => void;
const cache = createRateCache(async () => {
  calls++;
  return new Promise<RateSuggestion>((done) => { resolve = done; });
}, () => clock);
const first = cache.get("USD", "IDR", "2026-10-08");
assert.equal(cache.get("USD", "IDR", "2026-10-08"), first, "Two views share the same in-flight request");
await Promise.resolve();
assert.equal(calls, 1);
resolve(suggestion);
assert.equal(await first, suggestion);
assert.equal(await cache.get("USD", "IDR", "2026-10-08"), suggestion);
assert.equal(calls, 1, "Returning to a tab reuses the completed request");

clock = 60_000;
const expired = cache.get("USD", "IDR", "2026-10-08");
assert.notEqual(expired, first);
await Promise.resolve();
resolve(suggestion);
await expired;
assert.equal(calls, 2, "Expired results refetch");
const retried = cache.get("USD", "IDR", "2026-10-08", true);
assert.equal(cache.get("USD", "IDR", "2026-10-08", true), retried);
await Promise.resolve();
resolve(suggestion);
await retried;
assert.equal(calls, 3, "Retry bypasses fresh cached data without duplicating an active request");

let failures = 0;
const recovering = createRateCache(async () => {
  if (failures++ === 0) throw new Error("Temporary outage");
  return suggestion;
});
await assert.rejects(recovering.get("USD", "IDR", "2026-10-08"), /Temporary outage/);
assert.equal(await recovering.get("USD", "IDR", "2026-10-08"), suggestion, "Failed requests are not retained");

const keys: string[] = [];
const separate = createRateCache(async (from, to, date) => { keys.push(`${from}:${to}:${date}`); return suggestion; });
await separate.get("USD", "IDR", "2026-10-08");
await separate.get("CAD", "IDR", "2026-10-08");
await separate.get("USD", "CAD", "2026-10-08");
await separate.get("USD", "IDR", "2026-10-07");
assert.equal(keys.length, 4, "Currencies and dates have separate cache entries");
separate.clear();
await separate.get("USD", "IDR", "2026-10-08");
assert.equal(keys.length, 5, "Unmount clears completed results");

let signal!: AbortSignal;
const pending = createRateCache(async (_from, _to, _date, requestSignal) => { signal = requestSignal; return new Promise(() => {}); });
pending.get("USD", "IDR", "2026-10-08");
await Promise.resolve();
pending.clear();
assert.equal(signal.aborted, true, "Workspace unmount cancels pending work");
console.log("Exchange-rate cache checks passed: deduplication, freshness, retry, failure recovery, keys and cleanup.");
