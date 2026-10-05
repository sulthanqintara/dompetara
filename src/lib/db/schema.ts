export * from "./schema/auth";

import {
  pgTable,
  text,
  jsonb,
  integer,
  date,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./schema/auth";
import type { Ledger } from "@/features/ledger/ledger";
import type { RateSnapshot } from "@/features/exchange-rates/exchange-rates";

// ponytail: one JSON document per user ledger; normalize entries when history requires pagination.
export const ledger = pgTable("ledger", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  data: jsonb("data").$type<Ledger>().notNull(),
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
