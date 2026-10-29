import { z } from "zod";
import { currencies } from "./ledger.ts";
import { periodRange, validPeriod, type Period } from "./derive.ts";
import { transactionFiltersSchema } from "./transaction-filters.ts";
import type { Entry } from "./ledger.ts";

export const ledgerQuerySchema = z.object({
  start: z.string(), end: z.string(),
  timeZone: z.string().max(100).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }),
  displayCurrency: z.enum(currencies).default("IDR"),
  scope: z.enum(["summary", "report"]).default("report"),
  ...transactionFiltersSchema.shape,
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
}).refine(({ start, end }) => validPeriod(start, end));
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type LedgerOverview = {
  totals: { income: number; expense: number }; groups: [string, number][];
  daily: { date: string; amount: number }[]; monthly: { date: string; amount: number }[];
};
export type TransactionResult = {
  rows: Entry[]; related: Entry[]; page: number; pages: number; start: number; end: number; total: number;
};
export type QueryState<T> = { query: LedgerQuery; version: number; result: T };

export function matchingInitialQuery<T>(initial: QueryState<T> | undefined, query: LedgerQuery, version: number) {
  if (!initial || initial.version < version) return undefined;
  return JSON.stringify(initial.query) === JSON.stringify(query) ? initial : undefined;
}
export function ledgerQuery(period: Period, timeZone: string, displayCurrency: string, filters: Record<string, unknown> = {}) {
  return ledgerQuerySchema.parse({ ...filters, ...periodRange(period), timeZone, displayCurrency });
}
export function queryParams(query: LedgerQuery) {
  return new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
}
export function queryPeriod(query: LedgerQuery): Period {
  const month = query.start.slice(0, 7), period = { month };
  const range = periodRange(period);
  return query.start === range.start && query.end === range.end ? period : { start: query.start, end: query.end };
}
export function searchPattern(search: string) {
  return `%${search.trim().toLocaleLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
export function safeAggregate(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number)) throw new Error("Balance exceeds supported amount.");
  return number;
}
