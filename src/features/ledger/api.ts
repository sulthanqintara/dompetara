import { ledgerExport, type ExportFormat } from "./export";
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

export async function downloadLedger(format: ExportFormat) {
  const file = ledgerExport(await fetchLedger(), format);
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
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
