import "dotenv/config";
import { Pool } from "pg";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";
import { ledgerTables } from "./ledger-cutover.ts";
import { ledgerFromRows, type WalletRow, type CategoryRow, type TransactionRow, type ImportRow } from "../src/features/ledger/storage.ts";
import { ledgerUsage } from "../src/features/ledger/usage.ts";

// Reviewed one-time metadata initialization. Ledger data, rows, and versions remain unchanged.
const pool = new Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const ledgers = await client.query("SELECT user_id, version, usage, usage_version FROM public.ledger WHERE normalized FOR UPDATE");
  const fingerprint = await client.query("SELECT md5(string_agg(md5(data::text)||version::text, ',' ORDER BY user_id)) AS hash FROM public.ledger WHERE normalized");
  let updated = 0;
  for (const row of ledgers.rows) {
    if (row.usage && row.usage_version === row.version) continue;
    const records: Record<string, unknown[]> = {};
    for (const [key, table] of Object.entries(ledgerTables)) {
      const fields = Object.entries(table.columns).map(([name, column]) => `"${column}" AS "${name}"`).join(",");
      const result = await client.query(`SELECT ${fields} FROM public.${table.name} WHERE user_id=$1 ORDER BY position`, [row.user_id]);
      records[key] = result.rows;
    }
    const entries = records.entries as TransactionRow[];
    for (const entry of entries) { entry.amount = Number(entry.amount); if (entry.received !== null) entry.received = Number(entry.received); }
    const nextPosition = entries.reduce((max, entry) => Math.max(max, entry.position + 1), 0);
    const usage = ledgerUsage(ledgerFromRows(records.wallets as WalletRow[], records.categories as CategoryRow[], entries, records.imports as ImportRow[]), nextPosition);
    await client.query("UPDATE public.ledger SET usage=$1::jsonb, usage_version=version WHERE user_id=$2", [JSON.stringify(usage), row.user_id]);
    updated++;
  }
  const state = await client.query("SELECT count(*)::integer AS count FROM public.ledger WHERE normalized AND (usage IS NULL OR usage_version<>version)");
  if (state.rows[0].count !== 0) throw new Error("Ledger usage backfill did not finish.");
  const preserved = await client.query("SELECT md5(string_agg(md5(data::text)||version::text, ',' ORDER BY user_id)) AS hash FROM public.ledger WHERE normalized");
  if (preserved.rows[0].hash !== fingerprint.rows[0].hash) throw new Error("Ledger data or versions changed during metadata initialization.");
  await client.query("COMMIT");
  console.log(`Ledger usage initialized for ${updated} ledgers.`);
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { client.release(); await pool.end(); }
