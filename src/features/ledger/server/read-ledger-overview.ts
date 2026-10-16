import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { safeAggregate, type LedgerQuery, type LedgerOverview, type QueryState } from "../query";
import { ensureLedger } from "./ensure-ledger";

export async function readLedgerOverview(userId: string, query: LedgerQuery, initializeMissing = true): Promise<QueryState<LedgerOverview>> {
  const report = query.scope === "report";
  const result = await db.execute<{ version: number; normalized: boolean; income: string; expense: string;
    groups: { category: string; amount: string }[]; daily: { date: string; amount: string }[]; monthly: { date: string; amount: string }[];
  }>(sql`with period as materialized (
    select kind, category_name, date, amount_minor from ledger_transactions
    where user_id = ${userId} and currency = ${query.displayCurrency} and kind in ('income','expense')
      and date >= (${query.start}::date::timestamp at time zone ${query.timeZone})
      and date < ((${query.end}::date + 1)::timestamp at time zone ${query.timeZone})
  ) select version, normalized,
    (select coalesce(sum(amount_minor::numeric) filter (where kind='income'), 0)::text from period) as income,
    (select coalesce(sum(amount_minor::numeric) filter (where kind='expense'), 0)::text from period) as expense,
    ${report ? sql`(select coalesce(jsonb_agg(to_jsonb(groups) order by amount::numeric desc, category), '[]'::jsonb) from (
      select category_name as category, sum(amount_minor::numeric)::text as amount from period where kind='expense' group by category_name
    ) groups)` : sql`'[]'::jsonb`} as groups,
    ${report ? sql`(select coalesce(jsonb_agg(to_jsonb(daily) order by date), '[]'::jsonb) from (
      select to_char(date at time zone ${query.timeZone}, 'YYYY-MM-DD') as date, sum(amount_minor::numeric)::text as amount
      from period where kind='expense' group by 1
    ) daily)` : sql`'[]'::jsonb`} as daily,
    ${report ? sql`(select coalesce(jsonb_agg(to_jsonb(monthly) order by date), '[]'::jsonb) from (
      select to_char(date at time zone ${query.timeZone}, 'YYYY-MM') as date, sum(amount_minor::numeric)::text as amount
      from ledger_transactions where user_id=${userId} and currency=${query.displayCurrency} and kind='expense' group by 1
    ) monthly)` : sql`'[]'::jsonb`} as monthly
    from ledger where user_id=${userId}`);
  const row = result.rows[0];
  if (!row && initializeMissing) {
    await ensureLedger(userId);
    return readLedgerOverview(userId, query, false);
  }
  if (!row?.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
  return { query, version: row.version, result: {
    totals: { income: safeAggregate(row.income), expense: safeAggregate(row.expense) },
    groups: row.groups.map(({ category, amount }) => [category, safeAggregate(amount)]),
    daily: row.daily.map(({ date, amount }) => ({ date, amount: safeAggregate(amount) })),
    monthly: row.monthly.map(({ date, amount }) => ({ date, amount: safeAggregate(amount) })),
  } };
}
