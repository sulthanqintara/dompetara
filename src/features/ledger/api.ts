import { ledgerExport, type ExportFormat } from "./export";
import { queryParams, type LedgerQuery, type LedgerOverview, type TransactionResult, type QueryState } from "./query";
import type { Ledger, Entry } from "./ledger";

export type LedgerState = { data: Ledger; version: number; notice?: string;
  changes?: { before: Entry[]; after: Entry[]; invalidateTransactions: boolean } };

export async function fetchLedger(): Promise<LedgerState> {
  const response = await fetch("/api/ledger", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not load your ledger.");
  return result;
}

export async function saveLedger(
  payload: Record<string, unknown>,
  version: number,
): Promise<LedgerState> {
  const response = await fetch("/api/ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, version }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not save. Please try again.", {
      cause: response.status,
    });
  return result;
}

export async function downloadLedger(format: ExportFormat) {
  const response = await fetch("/api/ledger/export", { cache: "no-store" });
  const state = await response.json();
  if (!response.ok) throw new Error(state.error || "Could not export your ledger. Please try again.");
  const file = ledgerExport(state, format);
  const url = URL.createObjectURL(
    new Blob([file.content], { type: file.mimeType }),
  );
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = file.filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function fetchOverview(query: LedgerQuery, signal: AbortSignal): Promise<QueryState<LedgerOverview>> {
  const response = await fetch(`/api/ledger/overview?${queryParams(query)}`, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not load your ledger. Please try again.");
  return result;
}
export async function fetchTransactions(query: LedgerQuery, signal: AbortSignal): Promise<QueryState<TransactionResult>> {
  const response = await fetch(`/api/ledger/transactions?${queryParams(query)}`, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not load your ledger. Please try again.");
  return result;
}
