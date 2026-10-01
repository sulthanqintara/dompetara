import assert from "node:assert/strict";
import {
  cacheExpiry,
  convertMinor,
  crossRate,
  effectiveRate,
  normalizeRate,
  parseProviderRates,
  refreshSnapshot,
  validRateDate,
  type RateSnapshot,
} from "../src/features/exchange-rates/exchange-rates.ts";
import {
  convertedAmount,
  minorText,
  rateFromAmounts,
  transferTotals,
} from "../src/features/ledger/transfer.ts";

const now = new Date("2026-10-01T18:00:00Z");
const rows = [
  { base: "USD", quote: "IDR", date: "2026-10-01", rate: 17800 },
  { base: "USD", quote: "CAD", date: "2026-10-01", rate: 1.38 },
];
const snapshot: RateSnapshot = {
  provider: "ecb",
  baseCurrency: "USD",
  rates: { IDR: "17800", CAD: "1.38" },
  rateDate: "2026-10-01",
  etag: '"version-a"',
  lastCheckedAt: "2026-10-01T17:00:00Z",
  expiresAt: "2026-10-01T17:30:00Z",
};
assert.equal(normalizeRate("00001.380000000000"), "1.38");
assert.equal(convertMinor(10000, "17800"), 178000000);
assert.equal(convertMinor(1, "0.5"), 1);
assert.equal(effectiveRate(10000, 178000000), "17800");
assert.equal(effectiveRate(15933, 200000000), "12552.563861168644");
assert.equal(effectiveRate(200000000, 15933), "0.000079665");
assert.equal(convertMinor(15933, effectiveRate(15933, 200000000)), 200000000);
assert.equal(crossRate(snapshot.rates, "USD", "IDR"), "17800");
assert.equal(crossRate(snapshot.rates, "USD", "CAD"), "1.38");
assert.equal(crossRate(snapshot.rates, "IDR", "USD"), "0.000056179775");
assert.equal(crossRate(snapshot.rates, "CAD", "IDR"), "12898.550724637681");
assert.equal(crossRate(snapshot.rates, "CAD", "USD"), "0.724637681159");
assert.equal(crossRate(snapshot.rates, "IDR", "CAD"), "0.00007752809");
assert.equal(crossRate(snapshot.rates, "IDR", "IDR"), "1");
assert.equal(minorText(-29), "-0.29");
assert.deepEqual(convertedAmount("100", "17800"), {
  value: "1780000.00",
  error: "",
});
assert.equal(rateFromAmounts("100", "1780000"), "17800");
assert.deepEqual(transferTotals("200000", "200000", "1000", true), {
  debit: 20000000,
  credit: 19900000,
});
assert.deepEqual(transferTotals("200000", "200000", "1000", false), {
  debit: 20100000,
  credit: 20000000,
});
for (const rate of [
  "0",
  "-1",
  "NaN",
  "Infinity",
  "1e3",
  "1.1234567890123",
  "",
  1,
])
  assert.throws(() => normalizeRate(rate));
assert.throws(() => convertMinor(1, "0.00001"));
assert.throws(() => convertMinor(99999999999999, "17800"));
assert.equal(validRateDate("2026-02-30"), false);
assert.deepEqual(parseProviderRates(rows, now), {
  rates: snapshot.rates,
  rateDate: snapshot.rateDate,
});
for (const invalid of [
  [],
  [rows[0], rows[0]],
  [rows[0]],
  [rows[0], { ...rows[1], date: "2026-09-30" }],
  [rows[0], { ...rows[1], rate: -1 }],
  [rows[0], { ...rows[1], date: "2027-01-01" }],
])
  assert.throws(() => parseProviderRates(invalid, now));
assert.equal(
  cacheExpiry(
    new Headers({ "Cache-Control": "public, max-age=3600", Age: "600" }),
    now,
  ),
  "2026-10-01T18:50:00.000Z",
);
let calls = 0;
const request: typeof fetch = async (_url, options) => {
  calls++;
  assert.equal(
    (options?.headers as Record<string, string>)["If-None-Match"],
    snapshot.etag,
  );
  return new Response(null, {
    status: 304,
    headers: { "Cache-Control": "public, max-age=3600" },
  });
};
const revalidated = await refreshSnapshot(snapshot, request, now);
assert.equal(revalidated.status, "not-modified");
assert.deepEqual(revalidated.snapshot.rates, snapshot.rates);
assert.equal(revalidated.snapshot.rateDate, snapshot.rateDate);
assert.equal(revalidated.snapshot.lastCheckedAt, now.toISOString());
assert.equal(calls, 1);
const fresh = await refreshSnapshot(revalidated.snapshot, request, now);
assert.equal(fresh.status, "fresh");
assert.equal(calls, 1, "Fresh cache must not contact the provider.");
const downloaded = await refreshSnapshot(
  null,
  async () =>
    new Response(JSON.stringify(rows), { headers: { ETag: '"version-b"' } }),
  now,
);
assert.equal(downloaded.status, "updated");
assert.equal(downloaded.snapshot.etag, '"version-b"');
const original = structuredClone(snapshot);
await assert.rejects(
  refreshSnapshot(
    snapshot,
    async () => new Response(null, { status: 503 }),
    now,
  ),
);
assert.deepEqual(
  snapshot,
  original,
  "Failed refresh must preserve the last successful snapshot.",
);
await assert.rejects(
  refreshSnapshot(null, async () => new Response(null, { status: 304 }), now),
);
await assert.rejects(
  refreshSnapshot(
    snapshot,
    async () =>
      new Response(
        JSON.stringify(rows.map((r) => ({ ...r, date: "2026-09-30" }))),
      ),
    now,
  ),
);
console.log(
  "Exchange-rate checks passed: decimal conversion, rounding, all currency directions, provider validation, cache expiry, 200/304/fresh paths, and failed-refresh preservation.",
);
