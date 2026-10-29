"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type LedgerQuery, type QueryState } from "./query";
import { useLedgerStore } from "./use-ledger-store";

export function useLedgerQuery<T>(name: "transactions" | "overview", query: LedgerQuery,
  load: (query: LedgerQuery, signal: AbortSignal) => Promise<QueryState<T>>, initial?: QueryState<T>) {
  const version = useLedgerStore((state) => state.version);
  const state = useQuery({ queryKey: ["ledger", name, query], queryFn: ({ signal }) => load(query, signal),
    // A prefetched route can arrive after a confirmed mutation; never mark that older snapshot fresh.
    initialData: initial && initial.version >= version && JSON.stringify(initial.query) === JSON.stringify(query) ? initial : undefined,
    placeholderData: keepPreviousData });
  return { result: state.data?.result, error: state.error instanceof Error ? state.error.message : "",
    loading: state.isPending, refreshing: state.isFetching, placeholder: state.isPlaceholderData, displayedQuery: state.data?.query };
}
