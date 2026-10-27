import type { PoolClient } from "pg";
import type { ledgerStorageRows } from "../src/features/ledger/storage.ts";
import { ledgerTables } from "./ledger-cutover-tables.ts";

export async function insertLedgerRows(client: PoolClient, data: ReturnType<typeof ledgerStorageRows>) {
  for (const key of ["wallets", "categories", "entries", "imports"] as const) {
    const table = ledgerTables[key];
    // Parent transfers must exist before their linked service fees.
    const rows = key === "entries"
      ? [...data.entries.filter((entry) => !entry.transferId), ...data.entries.filter((entry) => entry.transferId)]
      : data[key];
    for (const record of rows) {
      const values = Object.keys(table.columns).map((key) => {
        const value = record[key as keyof typeof record];
        return value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value;
      });
      await client.query(`INSERT INTO public.${table.name} (${Object.values(table.columns).join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")})`, values);
    }
  }
}
