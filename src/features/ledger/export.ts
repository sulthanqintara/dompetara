import type { LedgerState } from "./api.ts";
import { walletName } from "./derive.ts";

export type ExportFormat = "json" | "csv";

function csvCell(value: string | number | undefined) {
  let text = value === undefined ? "" : String(value);
  // Keep user-entered text from becoming a spreadsheet formula.
  if (typeof value === "string" && /^(\s*[=+\-@]|[\t\r\n])/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ledgerExport(state: LedgerState, format: ExportFormat, now = new Date()) {
  const exportedAt = now.toISOString();
  let content: string;
  if (format === "json") {
    content = JSON.stringify({
      format: "dompetara",
      schemaVersion: 1,
      exportedAt,
      ledgerVersion: state.version,
      data: state.data,
    }, null, 2);
  } else {
    const headers = [
      "id", "kind", "date_utc", "wallet_id", "wallet", "currency", "amount", "amount_minor",
      "title", "category", "description", "to_wallet_id", "to_wallet", "to_currency",
      "received", "received_minor", "transfer_id", "exchange_rate", "rate_source", "rate_date", "receipt_details", "transaction_details",
    ];
    const rows = state.data.entries.map((entry) => [
      entry.id, entry.kind, entry.date, entry.wallet, walletName(state.data, entry.wallet),
      entry.currency, entry.amount / 100, entry.amount, entry.title, entry.category,
      entry.description, entry.toWallet, entry.toWallet ? walletName(state.data, entry.toWallet) : "",
      entry.toCurrency, entry.received === undefined ? "" : entry.received / 100,
      entry.received, entry.transferId, entry.exchangeRate?.value, entry.exchangeRate?.source,
      entry.exchangeRate?.referenceDate, entry.receipt ? JSON.stringify(entry.receipt) : "", entry.details ? JSON.stringify(entry.details) : "",
    ]);
    content = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
  return {
    content,
    filename: `dompetara-${exportedAt.replace(/[:.]/g, "-")}.${format}`,
    mimeType: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
  };
}
