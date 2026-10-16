import "server-only";
import { eq, asc } from "drizzle-orm";
import { ledgerWallets, ledgerCategories, ledgerTransactions, ledgerReceiptImports } from "@/lib/db/schema";
import { ledgerFromRows } from "../storage";
import type { LedgerDatabase } from "./database";
import { readLedgerSnapshot } from "./read-ledger-snapshot";

export async function readLedgerData(database: LedgerDatabase, userId: string, full = false) {
  if (full) {
    const wallets = await database.select().from(ledgerWallets).where(eq(ledgerWallets.userId, userId)).orderBy(asc(ledgerWallets.position));
    const categories = await database.select().from(ledgerCategories).where(eq(ledgerCategories.userId, userId)).orderBy(asc(ledgerCategories.position));
    const entries = await database.select().from(ledgerTransactions).where(eq(ledgerTransactions.userId, userId)).orderBy(asc(ledgerTransactions.position));
    const imports = await database.select().from(ledgerReceiptImports).where(eq(ledgerReceiptImports.userId, userId)).orderBy(asc(ledgerReceiptImports.position));
    return ledgerFromRows(wallets, categories, entries, imports);
  }
  const snapshot = await readLedgerSnapshot(database, userId);
  if (!snapshot) throw new Error("Ledger storage upgrade is required. Please try again later.");
  return snapshot.data;
}
