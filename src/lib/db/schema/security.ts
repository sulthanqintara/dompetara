import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const securityLimitBuckets = pgTable("security_limit_buckets", {
  keyHash: text("key_hash").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("security_limit_buckets_expiry_idx").on(table.expiresAt),
  check("security_limit_buckets_count_check", sql`${table.count} >= 0`),
]).enableRLS();

export const securityAdmissionLeases = pgTable("security_admission_leases", {
  scopeHash: text("scope_hash").notNull(),
  token: uuid("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.scopeHash, table.token] }),
  index("security_admission_leases_expiry_idx").on(table.expiresAt),
]).enableRLS();
