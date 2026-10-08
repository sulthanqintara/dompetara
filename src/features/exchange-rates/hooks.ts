import { useContext, useEffect, useState } from "react";
import type { Currency } from "../ledger/ledger";
import type { RateSuggestion } from "./exchange-rates";
import { RateCacheContext } from "./rate-cache-context";

export function useCachedRate(from: Currency, to: Currency, date: string, attempt = 0) {
  const cache = useContext(RateCacheContext);
  if (!cache) throw new Error("Exchange rates require a workspace provider.");
  const key = `${from}:${to}:${date}:${attempt}`;
  const [state, setState] = useState<{
    key: string;
    suggestion: RateSuggestion | null;
    error: string;
  }>({ key: "", suggestion: null, error: "" });
  useEffect(() => {
    if (from === to) return;
    let active = true;
    cache.get(from, to, date, attempt > 0)
      .then((suggestion) => {
        if (active)
          setState({
            key,
            suggestion,
            error: suggestion
              ? ""
              : "No cached rate for this date. Enter your actual rate or received amount.",
          });
      })
      .catch((error) => {
        if (active)
          setState({ key, suggestion: null, error: error instanceof Error ? error.message : "Suggested rate unavailable." });
      });
    // A different tab may still need the same in-flight request.
    return () => { active = false; };
  }, [from, to, date, key, attempt, cache]);
  return state.key === key
    ? { ...state, loading: false }
    : { suggestion: null, error: "", loading: from !== to };
}
