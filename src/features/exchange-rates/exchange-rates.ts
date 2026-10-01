import type { Currency } from "../ledger/ledger.ts";

export type RateSnapshot = {
  provider: "ecb";
  baseCurrency: "USD";
  rates: Record<"IDR" | "CAD", string>;
  rateDate: string;
  etag: string | null;
  lastCheckedAt: string;
  expiresAt: string;
};
export type RateSuggestion = {
  rate: string;
  rateDate: string;
  provider: "ecb";
  lastCheckedAt: string;
  stale: boolean;
};
export type AppliedRate = {
  value: string;
  source: "manual" | "received" | "ecb";
  referenceDate?: string;
};

const scale = BigInt("1000000000000");

export function rateUnits(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,12}(\.\d{1,12})?$/.test(value))
    throw new Error(
      "Enter a positive exchange rate with at most 12 decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * scale + BigInt(fraction.padEnd(12, "0"));
  if (units <= BigInt(0))
    throw new Error("Exchange rate must be greater than zero.");
  return units;
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

function rateText(units: bigint): string {
  const whole = units / scale;
  const fraction = (units % scale)
    .toString()
    .padStart(12, "0")
    .replace(/0+$/, "");
  const value = `${whole}${fraction ? `.${fraction}` : ""}`;
  rateUnits(value);
  return value;
}

export function normalizeRate(value: unknown): string {
  return rateText(rateUnits(value));
}

export function convertMinor(amount: number, rate: string): number {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Enter a positive amount.");
  const result = Number(roundedDivide(BigInt(amount) * rateUnits(rate), scale));
  if (!Number.isSafeInteger(result) || result > 99999999999999)
    throw new Error("Converted amount exceeds the supported amount.");
  if (result <= 0)
    throw new Error("Converted amount rounds to zero. Enter a larger amount.");
  return result;
}

export function effectiveRate(sent: number, received: number): string {
  if (
    !Number.isSafeInteger(sent) ||
    sent <= 0 ||
    !Number.isSafeInteger(received) ||
    received <= 0
  )
    throw new Error("Enter positive sent and received amounts.");
  return rateText(roundedDivide(BigInt(received) * scale, BigInt(sent)));
}

export function crossRate(
  rates: RateSnapshot["rates"],
  from: Currency,
  to: Currency,
): string {
  if (from === to) return "1";
  const source = from === "USD" ? scale : rateUnits(rates[from]);
  const target = to === "USD" ? scale : rateUnits(rates[to]);
  return rateText(roundedDivide(target * scale, source));
}

export function validRateDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function parseProviderRates(
  raw: unknown,
  now = new Date(),
): Pick<RateSnapshot, "rates" | "rateDate"> {
  if (!Array.isArray(raw) || raw.length !== 2)
    throw new Error("Incomplete exchange-rate response.");
  const rates: Partial<RateSnapshot["rates"]> = {};
  let rateDate = "";
  for (const row of raw) {
    if (
      !row ||
      row.base !== "USD" ||
      (row.quote !== "IDR" && row.quote !== "CAD") ||
      !validRateDate(row.date) ||
      row.date > now.toISOString().slice(0, 10) ||
      (rateDate && row.date !== rateDate) ||
      row.quote in rates ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate)
    )
      throw new Error("Invalid exchange-rate response.");
    rateDate = row.date;
    rates[row.quote as "IDR" | "CAD"] = normalizeRate(row.rate.toFixed(12));
  }
  if (!rates.IDR || !rates.CAD)
    throw new Error("Incomplete exchange-rate response.");
  return { rates: { IDR: rates.IDR, CAD: rates.CAD }, rateDate };
}

export function cacheExpiry(headers: Headers, now: Date): string {
  const match = headers.get("cache-control")?.match(/(?:^|,)\s*max-age=(\d+)/i);
  const age = Number(headers.get("age") ?? 0);
  const seconds = Math.max(
    0,
    Math.min(
      86400,
      Number(match?.[1] ?? 3600) - (Number.isFinite(age) ? age : 0),
    ),
  );
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export async function refreshSnapshot(
  previous: RateSnapshot | null,
  request: typeof fetch = fetch,
  now = new Date(),
): Promise<{
  status: "fresh" | "updated" | "not-modified";
  snapshot: RateSnapshot;
}> {
  if (previous && Date.parse(previous.expiresAt) > now.getTime())
    return { status: "fresh", snapshot: previous };
  const response = await request(
    "https://api.frankfurter.dev/v2/providers/ecb/rates?base=usd&quotes=idr,cad",
    {
      headers: previous?.etag ? { "If-None-Match": previous.etag } : {},
      signal: AbortSignal.timeout(15000),
    },
  );
  const lastCheckedAt = now.toISOString();
  const expiresAt = cacheExpiry(response.headers, now);
  if (response.status === 304) {
    if (!previous)
      throw new Error("Provider returned 304 without a saved snapshot.");
    return {
      status: "not-modified",
      snapshot: {
        ...previous,
        lastCheckedAt,
        expiresAt,
        etag: response.headers.get("etag") ?? previous.etag,
      },
    };
  }
  if (!response.ok)
    throw new Error(`Rate provider returned HTTP ${response.status}.`);
  const parsed = parseProviderRates(await response.json(), now);
  if (previous && parsed.rateDate < previous.rateDate)
    throw new Error("Provider returned an older rate snapshot.");
  return {
    status: "updated",
    snapshot: {
      provider: "ecb",
      baseCurrency: "USD",
      ...parsed,
      etag: response.headers.get("etag"),
      lastCheckedAt,
      expiresAt,
    },
  };
}
