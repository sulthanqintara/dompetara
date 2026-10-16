import "server-only";
import { sql } from "drizzle-orm";
import type { Entry } from "../ledger";
import type { LedgerDatabase } from "./database";

export async function validateAffectedBalances(database: LedgerDatabase, userId: string, entries: Entry[]) {
  const wallets = [...new Set(entries.flatMap((entry) => [entry.wallet, ...(entry.toWallet ? [entry.toWallet] : [])]))];
  if (!wallets.length) return;
  const ids = sql.join(wallets.map((id) => sql`${id}`), sql`, `);
  // Preserve safe-integer validation for every prefix in ledger order, without transferring history bodies.
  const result = await database.execute<{ unsafe: boolean }>(sql`with movements as (
    select wallet_id as wallet, currency, position, id,
      case when kind in ('expense','transfer') then -amount_minor::numeric else amount_minor::numeric end as amount
    from ledger_transactions where user_id = ${userId} and wallet_id in (${ids})
    union all select to_wallet_id, to_currency, position, id, received_minor::numeric
      from ledger_transactions where user_id = ${userId} and to_wallet_id in (${ids}) and kind = 'transfer'
  ), prefixes as (
    select sum(amount) over (partition by wallet, currency order by position, id rows unbounded preceding) as amount from movements
  ) select exists(select 1 from prefixes where abs(amount) > 9007199254740991) as unsafe`);
  if (result.rows[0].unsafe) throw new Error("Balance exceeds supported amount.");
}
