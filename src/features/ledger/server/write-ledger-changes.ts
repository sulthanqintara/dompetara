import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ledgerWallets, ledgerCategories, ledgerTransactions, ledgerReceiptImports } from "@/lib/db/schema";
import { ledgerStorageRows, ledgerFromRows, type CategoryRow, type TransactionRow } from "../storage";
import type { Ledger } from "../ledger";
import type { LedgerDatabase } from "./database";

export async function writeLedgerChanges(database: LedgerDatabase, userId: string, previous: Ledger, next: Ledger,
  context?: { categories: CategoryRow[]; positions: Pick<TransactionRow, "id" | "position">[]; nextPosition: number; nextImportPosition: number }) {
  const history = context?.categories ?? await database.select().from(ledgerCategories).where(eq(ledgerCategories.userId, userId));
  const before = ledgerStorageRows(userId, previous, history);
  const after = ledgerStorageRows(userId, next, history);
  // Existing rows retain ordering; updated/new entries move to the end just as before.
  const savedRows = context?.positions ?? await database.select({ id: ledgerTransactions.id, position: ledgerTransactions.position }).from(ledgerTransactions).where(eq(ledgerTransactions.userId, userId));
  const oldEntries = new Map(before.entries.map((row) => [row.id, row]));
  const savedEntries = new Map(savedRows.map((row) => [row.id, row]));
  const nextIds = new Set(after.entries.map((row) => row.id));
  let position = context?.nextPosition ?? savedRows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  for (const row of after.entries) {
    const old = oldEntries.get(row.id);
    const saved = savedEntries.get(row.id);
    row.position = old && saved && JSON.stringify({ ...old, position: 0 }) === JSON.stringify({ ...row, position: 0 }) ? saved.position : position++;
  }
  const removedEntries = before.entries.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
  if (removedEntries.length) await database.delete(ledgerTransactions).where(and(eq(ledgerTransactions.userId, userId), inArray(ledgerTransactions.id, removedEntries)));
  for (const row of after.wallets) {
    const old = before.wallets.find((wallet) => wallet.id === row.id);
    if (JSON.stringify(old) !== JSON.stringify(row)) await database.insert(ledgerWallets).values(row).onConflictDoUpdate({ target: [ledgerWallets.userId, ledgerWallets.id], set: { name: row.name, currencies: row.currencies, position: row.position } });
    if (old && old.name !== row.name) await database.execute(sql`update ledger_transactions e set search_text = concat_ws(' ', e.title, e.description, e.category_name,
      (select name from ledger_wallets where user_id = ${userId} and id = e.wallet_id),
      coalesce((select name from ledger_wallets where user_id = ${userId} and id = e.to_wallet_id), ''))
      where e.user_id = ${userId} and (e.wallet_id = ${row.id} or e.to_wallet_id = ${row.id})`);
  }
  // Archive removed categories before inserting a replacement with the same name.
  const removedCategories = before.categories.filter((row) => !row.archived && !next.categories.some((category) => category.id === row.id)).map((row) => row.id);
  if (removedCategories.length) await database.update(ledgerCategories).set({ archived: true }).where(and(eq(ledgerCategories.userId, userId), inArray(ledgerCategories.id, removedCategories)));
  for (const row of after.categories) {
    const old = history.find((category) => category.id === row.id);
    if (JSON.stringify(old) !== JSON.stringify(row)) await database.insert(ledgerCategories).values(row).onConflictDoUpdate({ target: [ledgerCategories.userId, ledgerCategories.id], set: { name: row.name, kind: row.kind, system: row.system, archived: row.archived, position: row.position } });
  }
  // Insert parents before their fees, whose composite FK cannot cross users.
  for (const row of [...after.entries.filter((row) => !row.transferId), ...after.entries.filter((row) => row.transferId)]) {
    const old = oldEntries.get(row.id);
    if (old && JSON.stringify({ ...old, position: 0 }) === JSON.stringify({ ...row, position: 0 })) continue;
    await database.insert(ledgerTransactions).values(row).onConflictDoUpdate({ target: [ledgerTransactions.userId, ledgerTransactions.id], set: row });
  }
  for (const row of after.imports) {
    if (!before.imports.some((record) => record.importId === row.importId)) {
      if (context) row.position += context.nextImportPosition;
      await database.insert(ledgerReceiptImports).values(row);
    }
  }
  const removedWallets = before.wallets.filter((row) => !after.wallets.some((wallet) => wallet.id === row.id)).map((row) => row.id);
  if (removedWallets.length) await database.delete(ledgerWallets).where(and(eq(ledgerWallets.userId, userId), inArray(ledgerWallets.id, removedWallets)));
  return {
    before: ledgerFromRows(before.wallets, before.categories, before.entries, before.imports),
    after: ledgerFromRows(after.wallets, after.categories, after.entries, after.imports),
    nextPosition: position,
    invalidateTransactions: JSON.stringify(before.wallets) !== JSON.stringify(after.wallets) || JSON.stringify(previous.categories) !== JSON.stringify(next.categories),
  };
}
