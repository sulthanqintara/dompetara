import type { QueryClient } from "@tanstack/react-query";
import type { LedgerState } from "./api";
import type { QueryState, LedgerOverview, TransactionResult } from "./query";
import { ledgerQueryAffected, patchTransactionCache, patchOverviewCache } from "./cache.ts";

export function updateLedgerCache(client: QueryClient, saved: LedgerState) {
  for (const query of client.getQueryCache().findAll({ queryKey: ["ledger"] })) {
    const name = query.queryKey[1], state = query.state.data as QueryState<unknown> | undefined;
    if (!state?.query || (name !== "transactions" && name !== "overview")) continue;
    const affected = state.version < saved.version - 1 || ledgerQueryAffected(name, state.query, saved);
    client.setQueryData(query.queryKey, name === "transactions" ? patchTransactionCache(state as QueryState<TransactionResult>, saved)
      : patchOverviewCache(state as QueryState<LedgerOverview>, saved));
    if (affected) void client.invalidateQueries({ queryKey: query.queryKey, exact: true });
  }
}
