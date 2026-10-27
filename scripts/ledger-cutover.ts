import assert from "node:assert/strict";
import type { Pool } from "pg";
import { insertLedgerRows } from "./insert-ledger-rows.ts";
import { verifyStoredLedger } from "./verify-stored-ledger.ts";
import { ledgerStorageRows, ledgerFromRows, comparableLedger } from "../src/features/ledger/storage.ts";

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
        await insertLedgerRows(client, data);
        await verifyStoredLedger(client, row.user_id, row.data);
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
