import assert from "node:assert/strict";
import { migrationDatabaseConfig } from "../src/lib/db/migration-database-config.ts";
import { supabaseRootCa } from "../src/lib/db/supabase-ca.ts";
const config = migrationDatabaseConfig("postgresql://postgres.project:p%40ss%3Aword@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=no-verify");
assert.ok("ssl" in config);
assert.deepEqual(config, {
  host: "aws-0-ap-southeast-1.pooler.supabase.com", port: 5432,
  user: "postgres.project", password: "p@ss:word", database: "postgres",
  ssl: { ca: supabaseRootCa, rejectUnauthorized: true },
});
const local = "postgresql://postgres:local-only@localhost:55432/dompetara_test";
assert.deepEqual(migrationDatabaseConfig(local), { url: local });
assert.throws(() => migrationDatabaseConfig(undefined), /valid DATABASE_URL/);
assert.throws(() => migrationDatabaseConfig("https://database.invalid"), /PostgreSQL/);
console.log("Migration configuration checks passed: trusted CA, decoded credentials, session-pooler compatibility, local URL preservation and invalid configuration.");
