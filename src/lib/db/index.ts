import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { logServerError } from "../log-server-error";
import { databasePoolConfig } from "./pool-config";
import * as schema from "./schema";

const globalDb = globalThis as typeof globalThis & {
  ledgerPool?: Pool;
};
const pool = globalDb.ledgerPool ?? new Pool(databasePoolConfig(process.env.DATABASE_URL, process.env.VERCEL === "1"));
if (!globalDb.ledgerPool) {
  attachDatabasePool(pool);
  pool.on("error", (error) => logServerError({ provider: "postgres", stage: "pool.idle-client", status: 500 }, error));
  globalDb.ledgerPool = pool;
}

// Drizzle uses unnamed queries; named prepared statements are incompatible with Supavisor transaction mode.
export const db = drizzle(pool, { schema });
