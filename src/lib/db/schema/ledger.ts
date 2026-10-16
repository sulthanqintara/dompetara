import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, bigint, timestamp, jsonb, primaryKey, foreignKey, index, uniqueIndex, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "./auth";
import type { Currency, Category, Entry } from "@/features/ledger/ledger";

export const ledgerWallets = pgTable("ledger_wallets", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  id: text("id").notNull(), name: text("name").notNull(),
  currencies: text("currencies").array().$type<Currency[]>().notNull(),
  position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] }),
  check("ledger_wallet_currencies", sql`cardinality(${t.currencies}) > 0 and ${t.currencies} <@ array['IDR','USD','CAD']::text[]`),
]).enableRLS();

export const ledgerCategories = pgTable("ledger_categories", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  id: text("id").notNull(), name: text("name").notNull(),
  kind: text("kind").$type<Category["kind"]>().notNull(),
  system: text("system").$type<Category["system"]>(),
  archived: boolean("archived").notNull().default(false), position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.id] }),
  check("ledger_category_kind", sql`${t.kind} in ('income','expense')`),
  check("ledger_category_system", sql`${t.system} is null or ${t.system} = 'adminFees'`),
  // Drizzle marks every column of an introspected expression index as an expression.
  // Match that representation to preserve this unique index during direct pushes.
  uniqueIndex("ledger_category_active_name").on(sql`user_id`, sql`kind`, sql`lower(name)`).where(sql`(NOT archived)`),
]).enableRLS();

export const ledgerTransactions = pgTable("ledger_transactions", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  id: text("id").notNull(), kind: text("kind").$type<Entry["kind"]>().notNull(),
  date: timestamp("date", { withTimezone: true, mode: "string" }).notNull(),
  // Preserve the original serialized timestamp in exports and edit forms.
  originalDate: text("original_date").notNull(),
  wallet: text("wallet_id").notNull(), currency: text("currency").$type<Currency>().notNull(),
  amount: bigint("amount_minor", { mode: "number" }).notNull(),
  title: text("title").notNull(), category: text("category_name").notNull(),
  categoryId: text("category_id"), description: text("description").notNull(),
  toWallet: text("to_wallet_id"), toCurrency: text("to_currency").$type<Currency>(),
  received: bigint("received_minor", { mode: "number" }), transferId: text("transfer_id"),
  exchangeRate: jsonb("exchange_rate").$type<Entry["exchangeRate"]>(),
  receipt: jsonb("receipt").$type<Entry["receipt"]>(), details: jsonb("details").$type<Entry["details"]>(),
  searchText: text("search_text").notNull(), position: integer("position").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.id] }),
  // Match PostgreSQL's existing 63-byte identifiers so direct synchronization never recreates these FKs.
  foreignKey({ name: "ledger_transactions_user_id_wallet_id_ledger_wallets_user_id_id", columns: [t.userId, t.wallet], foreignColumns: [ledgerWallets.userId, ledgerWallets.id] }),
  foreignKey({ name: "ledger_transactions_user_id_to_wallet_id_ledger_wallets_user_id", columns: [t.userId, t.toWallet], foreignColumns: [ledgerWallets.userId, ledgerWallets.id] }),
  foreignKey({ name: "ledger_transactions_user_id_category_id_ledger_categories_user_", columns: [t.userId, t.categoryId], foreignColumns: [ledgerCategories.userId, ledgerCategories.id] }),
  foreignKey({ name: "ledger_transactions_user_id_transfer_id_ledger_transactions_use", columns: [t.userId, t.transferId], foreignColumns: [t.userId, t.id as AnyPgColumn] }).onDelete("cascade"),
  index("ledger_transactions_history").on(t.userId, t.date.desc(), t.id),
  index("ledger_transactions_wallet_history").on(t.userId, t.wallet, t.date.desc(), t.id),
  index("ledger_transactions_destination_history").on(t.userId, t.toWallet, t.date.desc(), t.id),
  index("ledger_transactions_category_history").on(t.userId, t.category, t.date.desc(), t.id),
  index("ledger_transactions_search").using("gin", sql`lower(${t.searchText}) gin_trgm_ops`),
  uniqueIndex("ledger_transaction_transfer_fee").on(t.userId, t.transferId).where(sql`${t.transferId} is not null`),
  check("ledger_transaction_kind", sql`${t.kind} in ('income','expense','transfer','correction')`),
  check("ledger_transaction_currency", sql`${t.currency} in ('IDR','USD','CAD') and (${t.toCurrency} is null or ${t.toCurrency} in ('IDR','USD','CAD'))`),
  check("ledger_transaction_safe_amount", sql`${t.amount} between -9007199254740991 and 9007199254740991 and (${t.received} is null or ${t.received} between 1 and 9007199254740991)`),
  check("ledger_transaction_positive_amount", sql`${t.kind} = 'correction' or ${t.amount} > 0`),
  check("ledger_transaction_destination", sql`(${t.kind} = 'transfer' and ${t.toWallet} is not null and ${t.toCurrency} is not null and ${t.received} is not null and (${t.wallet} <> ${t.toWallet} or ${t.currency} <> ${t.toCurrency})) or (${t.kind} <> 'transfer' and ${t.toWallet} is null and ${t.toCurrency} is null and ${t.received} is null)`),
  check("ledger_transaction_category", sql`(${t.kind} in ('income','expense') and ${t.categoryId} is not null) or (${t.kind} in ('transfer','correction') and ${t.categoryId} is null)`),
  check("ledger_transaction_fee", sql`${t.transferId} is null or (${t.kind} = 'expense' and ${t.transferId} <> ${t.id})`),
]).enableRLS();

// Retained after transaction deletion so retrying an import never recreates spending.
export const ledgerReceiptImports = pgTable("ledger_receipt_imports", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  importId: text("import_id").notNull(), fingerprint: text("fingerprint").notNull(),
  entryId: text("entry_id").notNull(), position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.importId] }),
  uniqueIndex("ledger_receipt_import_fingerprint").on(t.userId, t.fingerprint),
]).enableRLS();
