import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactionJson } from "./transaction-json";
import { searchPattern, type LedgerQuery, type TransactionResult, type QueryState } from "../query";
import type { Entry } from "../ledger";
import { ensureLedger } from "./ensure-ledger";

export async function readTransactions(userId: string, query: LedgerQuery, initializeMissing = true): Promise<QueryState<TransactionResult>> {
  const conditions = [sql`e.user_id=${userId}`,
    sql`e.date >= (${query.start}::date::timestamp at time zone ${query.timeZone})`,
    sql`e.date < ((${query.end}::date + 1)::timestamp at time zone ${query.timeZone})`];
  if (query.wallet !== "all") conditions.push(sql`(e.wallet_id=${query.wallet} or e.to_wallet_id=${query.wallet})`);
  if (query.currency !== "all") conditions.push(sql`(e.currency=${query.currency} or e.to_currency=${query.currency})`);
  if (query.category !== "all") conditions.push(sql`e.category_name=${query.category}`);
  if (query.type !== "all") conditions.push(sql`e.kind=${query.type}`);
  if (query.search.trim()) conditions.push(sql`lower(e.search_text) like ${searchPattern(query.search)}`);
  const result = await db.execute<{ version: number; normalized: boolean; total: number; pages: number; page: number; rows: Entry[]; related: Entry[] }>(sql`
    with matched as not materialized (select e.* from ledger_transactions e where ${sql.join(conditions, sql` and `)}),
    counts as (select count(*)::integer as total from matched),
    bounds as (select total, greatest(1, ceil(total / 20.0)::integer) as pages,
      least(${query.page}::numeric, greatest(1, ceil(total / 20.0)::integer))::integer as page from counts),
    paged as (select * from matched order by date desc, id asc limit 20 offset (select (page-1)*20 from bounds)),
    identifiers as (select id from paged union select transfer_id from paged where transfer_id is not null)
    select l.version, l.normalized, b.total, b.pages, b.page,
      (select coalesce(jsonb_agg(${transactionJson(sql`e`)} order by e.date desc, e.id), '[]'::jsonb) from paged e) as rows,
      (select coalesce(jsonb_agg(${transactionJson(sql`e`)} order by e.position), '[]'::jsonb) from ledger_transactions e
        where e.user_id=${userId} and (e.id in (select id from identifiers) or e.transfer_id in (select id from identifiers))) as related
    from ledger l cross join bounds b where l.user_id=${userId}`);
  const row = result.rows[0];
  if (!row && initializeMissing) {
    await ensureLedger(userId);
    return readTransactions(userId, query, false);
  }
  if (!row?.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
  return { query, version: row.version, result: { rows: row.rows, related: row.related, page: row.page, pages: row.pages, total: row.total,
    start: row.total ? (row.page-1)*20+1 : 0, end: Math.min(row.total, row.page*20) } };
}
