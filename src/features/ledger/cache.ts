import type { LedgerState } from "./api";
import type { Entry } from "./ledger";
import type { LedgerQuery, LedgerOverview, TransactionResult, QueryState } from "./query";
import { filterTransactions } from "./transaction-filters.ts";
import { localDate } from "./format.ts";

const inPeriod = (entry: Entry, query: LedgerQuery) => {
  const date = localDate(new Date(entry.date), query.timeZone).slice(0, 10);
  return date >= query.start && date <= query.end;
};
const counted = (entry: Entry, query: LedgerQuery) => entry.currency === query.displayCurrency && (entry.kind === "income" || entry.kind === "expense");
const sortEntries = (rows: Entry[]) => rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function ledgerQueryAffected(name: string, query: LedgerQuery, saved: LedgerState) {
  if (!saved.changes) return true;
  const entries = [...saved.changes.before, ...saved.changes.after];
  if (name === "transactions") return saved.changes.invalidateTransactions || entries.some((entry) => inPeriod(entry, query) && filterTransactions([entry], saved.data, query).length > 0);
  return entries.some((entry) => counted(entry, query) && (inPeriod(entry, query) || (query.scope === "report" && entry.kind === "expense")));
}

export function patchTransactionCache(state: QueryState<TransactionResult>, saved: LedgerState): QueryState<TransactionResult> {
  if (!saved.changes || state.version >= saved.version) return state;
  const { before, after } = saved.changes;
  const matches = (rows: Entry[]) => filterTransactions(rows.filter((entry) => inPeriod(entry, state.query)), saved.data, state.query);
  const ids = new Set(before.map((entry) => entry.id));
  const visible = new Set(state.result.rows.map((entry) => entry.id));
  const candidates = after.filter((entry) => visible.has(entry.id) || (state.result.page === 1 &&
    (state.result.rows.length < 20 || Date.parse(entry.date) >= Date.parse(state.result.rows.at(-1)!.date))));
  const rows = sortEntries([...state.result.rows.filter((entry) => !ids.has(entry.id)), ...matches(candidates)]).slice(0, 20);
  const total = Math.max(0, state.result.total + (state.version === saved.version - 1 && !saved.changes.invalidateTransactions ? matches(after).length - matches(before).length : 0));
  const pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(state.result.page, pages);
  return { ...state, version: saved.version, result: { ...state.result, rows, total, pages, page,
    related: [...state.result.related.filter((entry) => !ids.has(entry.id)), ...after],
    start: total ? (page - 1) * 20 + 1 : 0, end: Math.min(total, (page - 1) * 20 + rows.length) } };
}

export function patchOverviewCache(state: QueryState<LedgerOverview>, saved: LedgerState): QueryState<LedgerOverview> {
  if (!saved.changes || state.version !== saved.version - 1) return state;
  const result = structuredClone(state.result);
  const groups = new Map(result.groups), daily = new Map(result.daily.map((row) => [row.date, row.amount])), monthly = new Map(result.monthly.map((row) => [row.date, row.amount]));
  for (const [entries, sign] of [[saved.changes.before, -1], [saved.changes.after, 1]] as const) {
    for (const entry of entries) {
      if (!counted(entry, state.query)) continue;
      const amount = sign * entry.amount, date = localDate(new Date(entry.date), state.query.timeZone).slice(0, 10);
      if (inPeriod(entry, state.query)) {
        result.totals[entry.kind as "income" | "expense"] += amount;
        if (entry.kind === "expense" && state.query.scope === "report") {
          groups.set(entry.category, (groups.get(entry.category) ?? 0) + amount);
          daily.set(date, (daily.get(date) ?? 0) + amount);
        }
      }
      if (entry.kind === "expense" && state.query.scope === "report") monthly.set(date.slice(0, 7), (monthly.get(date.slice(0, 7)) ?? 0) + amount);
    }
  }
  if (![...Object.values(result.totals), ...groups.values(), ...daily.values(), ...monthly.values()].every(Number.isSafeInteger)) return state;
  result.groups = [...groups].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const points = (map: Map<string, number>) => [...map].filter(([, amount]) => amount > 0).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
  result.daily = points(daily); result.monthly = points(monthly);
  return { ...state, version: saved.version, result };
}
