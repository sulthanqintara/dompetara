import "server-only";
import { sql } from "drizzle-orm";
import { ledgerFromRows, categoryFromRow, type CategoryRow, type WalletRow } from "../storage";
import { safeAggregate } from "../query";
import type { LedgerDatabase } from "./database";
import type { Currency } from "../ledger";

export async function readLedgerSnapshot(database: LedgerDatabase, userId: string) {
  // One database round trip for the bounded client view, with no transaction bodies.
  const result = await database.execute<{ version: number; normalized: boolean; wallets: WalletRow[]; categories: CategoryRow[]; balances: { wallet: string; currency: Currency; amount: string }[] }>(sql`
    with movements as (
      select wallet_id as wallet, currency,
        case when kind in ('expense','transfer') then -amount_minor::numeric else amount_minor::numeric end as amount
      from ledger_transactions where user_id = ${userId}
      union all
      select to_wallet_id, to_currency, received_minor::numeric from ledger_transactions where user_id = ${userId} and kind = 'transfer'
    ), totals as (select wallet, currency, sum(amount)::text as amount from movements group by wallet, currency)
    select l.version, l.normalized,
      (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'currencies', currencies, 'position', position) order by position), '[]'::jsonb) from ledger_wallets where user_id = ${userId}) as wallets,
      (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'system', c.system, 'archived', c.archived, 'position', c.position) order by c.position), '[]'::jsonb)
        from ledger_categories c where c.user_id = ${userId} and (not c.archived or exists (select 1 from ledger_transactions e where e.user_id = ${userId} and e.category_id = c.id))) as categories,
      (select coalesce(jsonb_agg(to_jsonb(totals)), '[]'::jsonb) from totals) as balances
    from ledger l where l.user_id = ${userId}
  `);
  const row = result.rows[0];
  if (!row) return null;
  if (!row.normalized) throw new Error("Ledger storage upgrade is required. Please try again later.");
  const balances = new Map<string, Partial<Record<Currency, number>>>();
  for (const balance of row.balances) {
    const values = balances.get(balance.wallet) ?? {};
    values[balance.currency] = safeAggregate(balance.amount);
    balances.set(balance.wallet, values);
  }
  return { version: row.version, data: { ...ledgerFromRows(row.wallets, row.categories, [], []),
    balanceTotals: Object.fromEntries(balances), historicalCategories: row.categories.filter((row) => row.archived).map(categoryFromRow),
  } };
}
