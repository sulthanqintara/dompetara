import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ledgerWallets, ledgerCategories, ledgerTransactions, ledgerReceiptImports } from "@/lib/db/schema";
import { ledgerFromRows, type CategoryRow, type TransactionRow } from "../storage";
import type { Ledger } from "../ledger";
import { planLedgerChanges } from "../write-plan";
import type { LedgerDatabase } from "./database";

export async function writeLedgerChanges(database: LedgerDatabase, userId: string, previous: Ledger, next: Ledger,
  context?: { categories: CategoryRow[]; positions: Pick<TransactionRow, "id" | "position">[]; nextPosition: number; nextImportPosition: number }) {
  const history = context?.categories ?? await database.select().from(ledgerCategories).where(eq(ledgerCategories.userId, userId));
  const savedRows = context?.positions ?? await database.select({ id: ledgerTransactions.id, position: ledgerTransactions.position }).from(ledgerTransactions).where(eq(ledgerTransactions.userId, userId));
  const plan = planLedgerChanges(userId, previous, next, { ...context, categories: history, positions: savedRows });
  const { before, after, removedEntries, removedCategories, removedWallets } = plan;
  if (removedEntries.length) await database.delete(ledgerTransactions).where(and(eq(ledgerTransactions.userId, userId), inArray(ledgerTransactions.id, removedEntries)));
  for (const row of plan.wallets) {
    await database.insert(ledgerWallets).values(row).onConflictDoUpdate({ target: [ledgerWallets.userId, ledgerWallets.id], set: { name: row.name, currencies: row.currencies, position: row.position } });
  }
  for (const row of plan.renamedWallets) {
    await database.execute(sql`update ledger_transactions e set search_text = concat_ws(' ', e.title, e.description, e.category_name,
      (select name from ledger_wallets where user_id = ${userId} and id = e.wallet_id),
      coalesce((select name from ledger_wallets where user_id = ${userId} and id = e.to_wallet_id), ''))
      where e.user_id = ${userId} and (e.wallet_id = ${row.id} or e.to_wallet_id = ${row.id})`);
  }
  // Archive removed categories before inserting a replacement with the same name.
  if (removedCategories.length) await database.update(ledgerCategories).set({ archived: true }).where(and(eq(ledgerCategories.userId, userId), inArray(ledgerCategories.id, removedCategories)));
  for (const row of plan.categories) {
    await database.insert(ledgerCategories).values(row).onConflictDoUpdate({ target: [ledgerCategories.userId, ledgerCategories.id], set: { name: row.name, kind: row.kind, system: row.system, archived: row.archived, position: row.position } });
  }
  // Insert parents before their fees, whose composite FK cannot cross users.
  for (const row of plan.entries) {
    await database.insert(ledgerTransactions).values(row).onConflictDoUpdate({ target: [ledgerTransactions.userId, ledgerTransactions.id], set: row });
  }
  for (const row of plan.imports) await database.insert(ledgerReceiptImports).values(row);
  if (removedWallets.length) await database.delete(ledgerWallets).where(and(eq(ledgerWallets.userId, userId), inArray(ledgerWallets.id, removedWallets)));
  return {
    before: ledgerFromRows(before.wallets, before.categories, before.entries, before.imports),
    after: ledgerFromRows(after.wallets, after.categories, after.entries, after.imports),
    nextPosition: plan.nextPosition,
    invalidateTransactions: plan.invalidateTransactions,
  };
}
