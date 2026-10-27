import type { Ledger } from "./ledger-model.ts";
import { ledgerStorageRows, type CategoryRow, type TransactionRow } from "./storage.ts";

export type WriteContext = {
  categories: CategoryRow[];
  positions: Pick<TransactionRow, "id" | "position">[];
  nextPosition?: number;
  nextImportPosition?: number;
};

function sameTransaction(before: TransactionRow | undefined, after: TransactionRow) {
  return before !== undefined && JSON.stringify({ ...before, position: 0 }) === JSON.stringify({ ...after, position: 0 });
}

function changedRows<T extends { id: string }>(before: T[], after: T[]) {
  const old = new Map(before.map((row) => [row.id, row]));
  return after.filter((row) => JSON.stringify(old.get(row.id)) !== JSON.stringify(row));
}

function removedIds(before: { id: string }[], after: { id: string }[]) {
  const remaining = new Set(after.map((row) => row.id));
  return before.filter((row) => !remaining.has(row.id)).map((row) => row.id);
}

export function planLedgerChanges(userId: string, previous: Ledger, next: Ledger, context: WriteContext) {
  const before = ledgerStorageRows(userId, previous, context.categories);
  const after = ledgerStorageRows(userId, next, context.categories);
  const oldEntries = new Map(before.entries.map((row) => [row.id, row]));
  const savedEntries = new Map(context.positions.map((row) => [row.id, row]));
  let position = context.nextPosition ?? context.positions.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const entries = after.entries.filter((row) => !sameTransaction(oldEntries.get(row.id), row));
  for (const row of after.entries) {
    const saved = savedEntries.get(row.id);
    row.position = saved && sameTransaction(oldEntries.get(row.id), row) ? saved.position : position++;
  }
  const oldWallets = new Map(before.wallets.map((row) => [row.id, row]));
  const renamedWallets = after.wallets.filter((row) => {
    const old = oldWallets.get(row.id);
    return old !== undefined && old.name !== row.name;
  });
  const oldImports = new Set(before.imports.map((row) => row.importId));
  const imports = after.imports.filter((row) => !oldImports.has(row.importId));
  for (const row of imports) row.position += context.nextImportPosition ?? 0;
  return {
    before, after, nextPosition: position,
    entries: [...entries.filter((row) => !row.transferId), ...entries.filter((row) => row.transferId)],
    wallets: changedRows(before.wallets, after.wallets), renamedWallets,
    categories: changedRows(context.categories, after.categories), imports,
    removedEntries: removedIds(before.entries, after.entries),
    removedCategories: removedIds(before.categories.filter((row) => !row.archived), next.categories),
    removedWallets: removedIds(before.wallets, after.wallets),
    invalidateTransactions: JSON.stringify(before.wallets) !== JSON.stringify(after.wallets) || JSON.stringify(previous.categories) !== JSON.stringify(next.categories),
  };
}
