export * from "./schema/auth";
export * from "./schema/security";
export * from "./schema/ledger";

import {
  pgTable,
  text,
  jsonb,
  integer,
  date,
  timestamp,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import { user } from "./schema/auth";
import type { Ledger } from "@/features/ledger/ledger";
import type { LedgerUsage } from "@/features/ledger/usage";
import type { RateSnapshot } from "@/features/exchange-rates/exchange-rates";

// Legacy JSON is retained as a cutover snapshot, never read/written by the normalized app.
export const ledger = pgTable("ledger", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  data: jsonb("data").$type<Ledger>().notNull(),
  normalized: boolean("normalized").notNull().default(false),
  usage: jsonb("usage").$type<LedgerUsage>(),
  // An older compatible deployment can still write rows; rebuild metadata once if its version diverges.
  usageVersion: integer("usage_version").notNull().default(-1),
}).enableRLS();

export const exchangeRateCache = pgTable(
  "exchange_rate_cache",
  {
    provider: text("provider").notNull(),
    baseCurrency: text("base_currency").notNull(),
    rateDate: date("rate_date").notNull(),
    rates: jsonb("rates").$type<RateSnapshot["rates"]>().notNull(),
    etag: text("etag"),
    lastCheckedAt: timestamp("last_checked_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.baseCurrency, table.rateDate],
    }),
  ],
).enableRLS();

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  locale: text("locale").$type<import("@/features/i18n/i18n").Locale>(),
  languagePromptShownAt: timestamp("language_prompt_shown_at", { withTimezone: true }).notNull(),
}).enableRLS();
