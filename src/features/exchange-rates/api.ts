import type { Currency } from "../ledger/ledger";
import type { RateSuggestion } from "./exchange-rates";

export async function fetchCachedRate(
  from: Currency,
  to: Currency,
  date: string,
  signal: AbortSignal,
): Promise<RateSuggestion | null> {
  const query = new URLSearchParams({ from, to, date });
  const response = await fetch(`/api/exchange-rates?${query}`, { signal });
  if (!response.ok)
    throw new Error(
      "Suggested rate unavailable. Enter your actual rate or received amount.",
    );
  const result = await response.json();
  return result.suggestion;
}
