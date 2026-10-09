import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { migrationDatabaseConfig } from "./src/lib/db/migration-database-config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: migrationDatabaseConfig(process.env.DATABASE_URL),
});
