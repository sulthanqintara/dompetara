import assert from "node:assert/strict";
import type { Pool } from "pg";
import { ledgerStorageRows, ledgerFromRows, comparableLedger } from "../src/features/ledger/storage.ts";

export const ledgerTables = {
  wallets: { name: "ledger_wallets", columns: { userId: "user_id", id: "id", name: "name", currencies: "currencies", position: "position" } },
  categories: { name: "ledger_categories", columns: { userId: "user_id", id: "id", name: "name", kind: "kind", system: "system", archived: "archived", position: "position" } },
  entries: { name: "ledger_transactions", columns: { userId: "user_id", id: "id", kind: "kind", date: "date", originalDate: "original_date", wallet: "wallet_id", currency: "currency", amount: "amount_minor", title: "title", category: "category_name", categoryId: "category_id", description: "description", toWallet: "to_wallet_id", toCurrency: "to_currency", received: "received_minor", transferId: "transfer_id", exchangeRate: "exchange_rate", receipt: "receipt", details: "details", searchText: "search_text", position: "position" } },
  imports: { name: "ledger_receipt_imports", columns: { userId: "user_id", importId: "import_id", fingerprint: "fingerprint", entryId: "entry_id", position: "position" } },
} as const;

export async function cutoverLedgers(pool: Pool, apply = false, userId?: string) {
  const client = await pool.connect();
  let ledgers = 0, entries = 0;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    if (apply) await client.query("LOCK TABLE public.ledger IN SHARE ROW EXCLUSIVE MODE");
    const source = await client.query("SELECT user_id, data FROM public.ledger WHERE NOT normalized AND ($1::text IS NULL OR user_id = $1) ORDER BY user_id", [userId ?? null]);
    for (const row of source.rows) {
      const data = ledgerStorageRows(row.user_id, row.data);
      const rebuilt = ledgerFromRows(data.wallets, data.categories, data.entries, data.imports);
      assert.deepEqual(comparableLedger(rebuilt), comparableLedger(row.data), "Ledger round-trip validation failed.");
      if (apply) {
        for (const key of ["wallets", "categories", "entries", "imports"] as const) {
          const table = ledgerTables[key];
          const rows = key === "entries" ? [...data.entries.filter((entry) => !entry.transferId), ...data.entries.filter((entry) => entry.transferId)] : data[key];
          for (const record of rows) {
            const values = Object.keys(table.columns).map((key) => {
              const value = record[key as keyof typeof record];
              return value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value;
            });
            await client.query(`INSERT INTO public.${table.name} (${Object.values(table.columns).join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")})`, values);
          }
        }
        const restored: Record<string, unknown[]> = {};
        for (const [key, table] of Object.entries(ledgerTables)) {
          const result = await client.query(`SELECT ${Object.entries(table.columns).map(([key, column]) => `${column} AS "${key}"`).join(",")} FROM public.${table.name} WHERE user_id = $1 ORDER BY position`, [row.user_id]);
          restored[key] = result.rows;
        }
        for (const record of restored.entries as { amount: string | number; received: string | number | null }[]) {
          record.amount = Number(record.amount);
          if (record.received !== null) record.received = Number(record.received);
        }
        const actual = ledgerFromRows(restored.wallets as typeof data.wallets, restored.categories as typeof data.categories, restored.entries as typeof data.entries, restored.imports as typeof data.imports);
        assert.deepEqual(comparableLedger(actual), comparableLedger(row.data), "Stored ledger round-trip validation failed.");
        await client.query("UPDATE public.ledger SET normalized = true WHERE user_id = $1", [row.user_id]);
      }
      ledgers++; entries += data.entries.length;
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    return { ledgers, entries, applied: apply };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
