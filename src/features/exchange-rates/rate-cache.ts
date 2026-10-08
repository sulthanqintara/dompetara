import type { Currency } from "../ledger/ledger.ts";
import type { RateSuggestion } from "./exchange-rates.ts";

type LoadRate = (from: Currency, to: Currency, date: string, signal: AbortSignal) => Promise<RateSuggestion | null>;

// Each signed-in workspace owns this cache. Never share it between server requests.
export function createRateCache(load: LoadRate, now = Date.now) {
  const entries = new Map<string, {
    promise: Promise<RateSuggestion | null>;
    controller: AbortController;
    expiresAt: number;
    pending: boolean;
  }>();
  return {
    get(from: Currency, to: Currency, date: string, refresh = false) {
      const key = `${from}:${to}:${date}`;
      const saved = entries.get(key);
      if (saved && (saved.pending || (!refresh && saved.expiresAt > now()))) return saved.promise;
      const controller = new AbortController();
      const entry = { controller, expiresAt: 0, pending: true, promise: Promise.resolve(null) as Promise<RateSuggestion | null> };
      entry.promise = Promise.resolve().then(() => load(from, to, date, controller.signal)).then((suggestion) => {
        entry.pending = false;
        entry.expiresAt = now() + 60_000;
        return suggestion;
      }, (error: unknown) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      if (entries.size >= 32 && !entries.has(key)) entries.delete(entries.keys().next().value!);
      entries.set(key, entry);
      return entry.promise;
    },
    clear() {
      for (const entry of entries.values()) if (entry.pending) entry.controller.abort();
      entries.clear();
    },
  };
}
