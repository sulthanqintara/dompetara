import { ledgerExport, type ExportFormat } from "./export";
import type { Ledger } from "./ledger";
import { prepareReceiptImage } from "../receipts/api";

export type LedgerState = { data: Ledger; version: number; notice?: string };

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
  const { receiptImage, ...values } = payload;
  let body: FormData | string;
  if (receiptImage instanceof File) {
    body = new FormData();
    body.set("payload", JSON.stringify({ ...values, version }));
    body.set("image", await prepareReceiptImage(receiptImage), "receipt.jpg");
  } else body = JSON.stringify({ ...values, version });
  const response = await fetch("/api/ledger", {
    method: "POST",
    ...(typeof body === "string"
      ? { headers: { "Content-Type": "application/json" } }
      : {}),
    body,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not save. Please try again.", {
      cause: response.status,
    });
  return result;
}

export async function downloadLedger(format: ExportFormat) {
  const file = ledgerExport(await fetchLedger(), format);
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
