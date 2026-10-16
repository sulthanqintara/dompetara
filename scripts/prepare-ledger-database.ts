import "dotenv/config";
import { Pool } from "pg";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";

const pool = new Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
try {
  // Required by the schema's substring-search GIN index; manages no provider schemas.
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  console.log("Ledger search extension ready.");
} finally { await pool.end(); }
