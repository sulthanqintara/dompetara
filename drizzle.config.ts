import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { migrationDatabaseConfig } from "./src/lib/db/migration-database-config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  schemaFilter: ["public"],
  tablesFilter: [
    "user", "session", "account", "verification", "ledger", "receipt_images",
    "exchange_rate_cache", "user_preferences", "security_limit_buckets", "security_admission_leases",
  ],
  dbCredentials: migrationDatabaseConfig(process.env.DATABASE_URL),
});
