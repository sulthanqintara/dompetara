"use client";
import { createContext } from "react";
import type { createRateCache } from "./rate-cache";

export const RateCacheContext = createContext<ReturnType<typeof createRateCache> | null>(null);
