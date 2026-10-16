import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";

const pool = new Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
try {
  await pool.query(await readFile(new URL("./database-security.sql", import.meta.url), "utf8"));
  await pool.query(await readFile(new URL("./security-admission.sql", import.meta.url), "utf8"));
  await pool.query("SELECT cron.schedule('dompetara-security-cleanup', '* * * * *', 'SELECT public.cleanup_security_limits(4096)')");
  console.log("App table permissions secured.");
} finally {
  await pool.end();
}
