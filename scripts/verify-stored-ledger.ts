import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { ledgerFromRows, comparableLedger } from "../src/features/ledger/storage.ts";
import { ledgerTables } from "./ledger-cutover-tables.ts";

export async function verifyStoredLedger(client: PoolClient, userId: string, original: unknown) {
  const restored: Record<string, unknown[]> = {};
  for (const [key, table] of Object.entries(ledgerTables)) {
    const result = await client.query(`SELECT ${Object.entries(table.columns).map(([key, column]) => `${column} AS "${key}"`).join(",")} FROM public.${table.name} WHERE user_id = $1 ORDER BY position`, [userId]);
    restored[key] = result.rows;
  }
  for (const record of restored.entries as { amount: string | number; received: string | number | null }[]) {
    record.amount = Number(record.amount);
    if (record.received !== null) record.received = Number(record.received);
  }
  const actual = ledgerFromRows(
    restored.wallets as Parameters<typeof ledgerFromRows>[0],
    restored.categories as Parameters<typeof ledgerFromRows>[1],
    restored.entries as Parameters<typeof ledgerFromRows>[2],
    restored.imports as Parameters<typeof ledgerFromRows>[3],
  );
  assert.deepEqual(comparableLedger(actual), comparableLedger(original), "Stored ledger round-trip validation failed.");
}
