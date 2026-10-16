"use client";
import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function LedgerQueryProvider({ children }: { children: ReactNode }) {
  // Each account/layout gets an isolated memory cache; server renders never share it.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: {
    staleTime: 30_000, gcTime: 300_000, retry: false, refetchOnWindowFocus: false,
  }, mutations: { retry: false } } }));
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
