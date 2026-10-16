import "dotenv/config";
import { Pool } from "pg";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";
import { cutoverLedgers } from "./ledger-cutover.ts";

const pool = new Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
try {
  const result = await cutoverLedgers(pool, process.argv.includes("--apply"));
  console.log(JSON.stringify(result));
} catch {
  // Validation/provider exceptions may contain ledger values. Emit no personal data.
  console.error("Ledger cutover failed and was rolled back. Review the schema and stored-data validation privately before retrying.");
  process.exitCode = 1;
} finally { await pool.end(); }
