import { useEffect, useState } from "react";
import type { Currency } from "../ledger/ledger";
import type { RateSuggestion } from "./exchange-rates";
import { fetchCachedRate } from "./api";

export function useCachedRate(from: Currency, to: Currency, date: string) {
  const key = `${from}:${to}:${date}`;
  const [state, setState] = useState<{
    key: string;
    suggestion: RateSuggestion | null;
    error: string;
  }>({ key: "", suggestion: null, error: "" });
  useEffect(() => {
    if (from === to) return;
    const controller = new AbortController();
    fetchCachedRate(from, to, date, controller.signal)
      .then((suggestion) => {
        if (!controller.signal.aborted)
          setState({
            key,
            suggestion,
            error: suggestion
              ? ""
              : "No cached rate for this date. Enter your actual rate or received amount.",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, suggestion: null, error: error.message });
      });
    return () => controller.abort();
  }, [from, to, date, key]);
  return state.key === key
    ? { ...state, loading: false }
    : { suggestion: null, error: "", loading: from !== to };
}
