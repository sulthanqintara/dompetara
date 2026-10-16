import "server-only";
import { sql } from "drizzle-orm";
import type { CategoryRow, TransactionRow, WalletRow } from "../storage";
import type { Entry } from "../ledger";
import type { LedgerDatabase } from "./database";
import { transactionJson } from "./transaction-json";

export async function readMutationContext(database: LedgerDatabase, userId: string, payload: Record<string, unknown>) {
  const id = typeof payload.id === "string" ? payload.id : "";
  const fingerprint = typeof payload.receipt === "object" && payload.receipt !== null && "fingerprint" in payload.receipt
    ? String(payload.receipt.fingerprint) : "";
  const result = await database.execute<{
    wallets: WalletRow[]; categories: CategoryRow[]; entries: Entry[];
    positions: Pick<TransactionRow, "id" | "position">[]; walletBalance: string; walletHasHistory: boolean; duplicateReceipt: boolean;
  }>(sql`with selected as (
    select * from ledger_transactions where user_id = ${userId} and (id = ${id} or transfer_id = ${id})
  ) select
    (select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'id', id, 'name', name, 'currencies', currencies, 'position', position) order by position), '[]'::jsonb)
      from ledger_wallets where user_id = ${userId}) as wallets,
    (select coalesce(jsonb_agg(jsonb_build_object('userId', c.user_id, 'id', c.id, 'name', c.name, 'kind', c.kind, 'system', c.system, 'archived', c.archived, 'position', c.position) order by c.position), '[]'::jsonb)
      from ledger_categories c where c.user_id = ${userId} and (not c.archived or c.id in (select category_id from selected))) as categories,
    (select coalesce(jsonb_agg(${transactionJson(sql`e`)} order by e.position), '[]'::jsonb) from selected e) as entries,
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'position', position)), '[]'::jsonb) from selected) as positions,
    ${payload.action === "wallet" ? sql`(select coalesce(sum(amount), 0)::text from (
      select case when kind in ('expense','transfer') then -amount_minor::numeric else amount_minor::numeric end as amount
      from ledger_transactions where user_id = ${userId} and wallet_id = ${id} and currency = ${String(payload.currency ?? "")}
      union all select received_minor::numeric from ledger_transactions where user_id = ${userId}
        and to_wallet_id = ${id} and to_currency = ${String(payload.currency ?? "")} and kind = 'transfer'
    ) movements)` : sql`'0'::text`} as "walletBalance",
    ${payload.action === "deleteWallet" ? sql`exists(select 1 from ledger_transactions where user_id = ${userId} and (wallet_id = ${id} or to_wallet_id = ${id}))` : sql`false`} as "walletHasHistory",
    ${fingerprint && !id ? sql`exists(select 1 from ledger_transactions where user_id = ${userId} and receipt->>'fingerprint' = ${fingerprint})` : sql`false`} as "duplicateReceipt"`);
  return result.rows[0];
}
