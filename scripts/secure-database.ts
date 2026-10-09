import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { databasePoolConfig } from "../src/lib/db/pool-config.ts";

const pool = new Pool({ ...databasePoolConfig(process.env.DATABASE_URL), max: 1 });
try {
  await pool.query(await readFile(new URL("./database-security.sql", import.meta.url), "utf8"));
  console.log("App table permissions secured.");
} finally {
  await pool.end();
}
