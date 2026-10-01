import type { Entry } from "./ledger.ts";

// ponytail: paginate rendered rows; page database reads when whole-ledger loading becomes slow.
export function transactionPage(entries: Entry[], value: unknown, pageSize = 20) {
  const requested = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = Math.min(pages, Number.isSafeInteger(requested) ? requested : 1);
  const offset = (page - 1) * pageSize;
  return { page, pages, rows: entries.slice(offset, offset + pageSize), total: entries.length,
    start: entries.length ? offset + 1 : 0, end: Math.min(entries.length, offset + pageSize) };
}
