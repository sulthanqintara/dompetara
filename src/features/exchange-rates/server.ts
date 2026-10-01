import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { exchangeRateCache } from "@/lib/db/schema";
import { crossRate, type RateSuggestion } from "./exchange-rates";
import type { Currency } from "../ledger/ledger";

export async function readCachedRate(
  from: Currency,
  to: Currency,
  date: string,
): Promise<RateSuggestion | null> {
  const [row] = await db
    .select()
    .from(exchangeRateCache)
    .where(
      and(
        eq(exchangeRateCache.provider, "ecb"),
        eq(exchangeRateCache.baseCurrency, "USD"),
        lte(exchangeRateCache.rateDate, date),
      ),
    )
    .orderBy(desc(exchangeRateCache.rateDate))
    .limit(1);
  if (!row) return null;
  return {
    rate: crossRate(row.rates, from, to),
    provider: "ecb",
    rateDate: row.rateDate,
    lastCheckedAt: row.lastCheckedAt.toISOString(),
    // ponytail: four-day warning covers ordinary weekends; add provider calendars if holiday freshness needs precision.
    stale: Date.now() - row.lastCheckedAt.getTime() > 4 * 86400000,
  };
}
