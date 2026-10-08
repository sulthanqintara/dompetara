"use client";
import { useEffect, useState, type ReactNode } from "react";
import { fetchCachedRate } from "../api";
import { createRateCache } from "../rate-cache";
import { RateCacheContext } from "../rate-cache-context";

export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(() => createRateCache(fetchCachedRate));
  useEffect(() => () => cache.clear(), [cache]);
  return <RateCacheContext.Provider value={cache}>{children}</RateCacheContext.Provider>;
}
