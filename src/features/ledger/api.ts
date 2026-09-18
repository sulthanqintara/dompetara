import type { Ledger } from "./ledger";

export type LedgerState = { data: Ledger; version: number };

export async function fetchLedger(): Promise<LedgerState> {
  const response = await fetch("/api/ledger");
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
    throw new Error(result.error || "Could not save. Please try again.");
  return result;
}
