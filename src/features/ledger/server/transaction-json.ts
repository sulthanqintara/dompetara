import { sql, type SQL } from "drizzle-orm";

export function transactionJson(alias: SQL) {
  return sql`jsonb_build_object(
    'id', ${alias}.id, 'kind', ${alias}.kind, 'date', ${alias}.original_date,
    'wallet', ${alias}.wallet_id, 'currency', ${alias}.currency, 'amount', ${alias}.amount_minor,
    'title', ${alias}.title, 'category', ${alias}.category_name, 'description', ${alias}.description)
    || (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(jsonb_build_object(
    'categoryId', ${alias}.category_id, 'toWallet', ${alias}.to_wallet_id, 'toCurrency', ${alias}.to_currency,
    'received', ${alias}.received_minor, 'transferId', ${alias}.transfer_id,
    'exchangeRate', ${alias}.exchange_rate, 'receipt', ${alias}.receipt, 'details', ${alias}.details))
    where value <> 'null'::jsonb)`;
}
