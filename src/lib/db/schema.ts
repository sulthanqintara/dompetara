export * from "./schema/auth";

import { pgTable, text, jsonb, integer } from "drizzle-orm/pg-core";
import { user } from "./schema/auth";
import type { Ledger } from "@/features/ledger/ledger";

// ponytail: one JSON document per personal ledger; normalize entries when history requires pagination.
export const ledger = pgTable("ledger", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(0),
  data: jsonb("data").$type<Ledger>().notNull(),
}).enableRLS();
