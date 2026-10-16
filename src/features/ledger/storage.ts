import { z } from "zod";
import { currencies, ledgerBalances, type Ledger, type Category, type Entry } from "./ledger.ts";
import { receiptSchema, transactionDetailsSchema } from "../receipts/receipts.ts";
import type { ledgerWallets, ledgerCategories, ledgerTransactions, ledgerReceiptImports } from "../../lib/db/schema/ledger.ts";

const amountSchema = z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const currencySchema = z.enum(currencies);
const categorySchema = z.object({ id: z.string().min(1), name: z.string().min(1), kind: z.enum(["income", "expense"]), system: z.literal("adminFees").optional() });
const entrySchema = z.object({
  id: z.string().min(1), kind: z.enum(["income", "expense", "transfer", "correction"]),
  date: z.string().refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))),
  wallet: z.string().min(1), currency: currencySchema, amount: amountSchema,
  title: z.string(), category: z.string(), categoryId: z.string().optional(), description: z.string(),
  toWallet: z.string().optional(), toCurrency: currencySchema.optional(), received: amountSchema.optional(),
  transferId: z.string().optional(),
  exchangeRate: z.object({ value: z.string(), source: z.enum(["manual", "received", "ecb"]), referenceDate: z.string().optional() }).optional(),
  receipt: receiptSchema.passthrough().optional(), details: transactionDetailsSchema.optional(),
});
export const storedLedgerSchema = z.object({
  wallets: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), currencies: z.array(currencySchema).min(1) })),
  categories: z.array(categorySchema), entries: z.array(entrySchema),
  receiptImports: z.array(z.object({ importId: z.string().min(1), fingerprint: z.string().min(1), entryId: z.string().min(1) })).optional(),
});
export type WalletRow = typeof ledgerWallets.$inferSelect;
export type CategoryRow = typeof ledgerCategories.$inferSelect;
export type TransactionRow = typeof ledgerTransactions.$inferSelect;
export type ImportRow = typeof ledgerReceiptImports.$inferSelect;

export function categoryFromRow(row: CategoryRow): Category {
  return { id: row.id, name: row.name, kind: row.kind, ...(row.system ? { system: row.system } : {}) };
}
export function entryFromRow(row: TransactionRow): Entry {
  return {
    id: row.id, kind: row.kind, date: row.originalDate, wallet: row.wallet, currency: row.currency,
    amount: row.amount, title: row.title, category: row.category, description: row.description,
    ...(row.categoryId ? { categoryId: row.categoryId } : {}),
    ...(row.toWallet ? { toWallet: row.toWallet } : {}), ...(row.toCurrency ? { toCurrency: row.toCurrency } : {}),
    ...(row.received !== null ? { received: row.received } : {}), ...(row.transferId ? { transferId: row.transferId } : {}),
    ...(row.exchangeRate ? { exchangeRate: row.exchangeRate } : {}),
    ...(row.receipt ? { receipt: row.receipt } : {}), ...(row.details ? { details: row.details } : {}),
  };
}
export function ledgerFromRows(wallets: WalletRow[], categories: CategoryRow[], entries: TransactionRow[], imports: ImportRow[]): Ledger {
  return {
    wallets: wallets.map(({ id, name, currencies }) => ({ id, name, currencies })),
    categories: categories.filter((row) => !row.archived).map(categoryFromRow),
    entries: entries.map(entryFromRow),
    ...(imports.length ? { receiptImports: imports.map(({ importId, fingerprint, entryId }) => ({ importId, fingerprint, entryId })) } : {}),
  };
}

export function ledgerStorageRows(userId: string, raw: unknown, historical: CategoryRow[] = []) {
  const data = storedLedgerSchema.parse(raw);
  for (const list of [data.wallets, data.categories, data.entries]) {
    if (new Set(list.map((item) => item.id)).size !== list.length) throw new Error("Duplicate ledger identifiers.");
  }
  const wallets: WalletRow[] = data.wallets.map((wallet, position) => ({ ...wallet, userId, position }));
  const categories: CategoryRow[] = data.categories.map((category, position) => ({ ...category, system: category.system ?? null, userId, archived: false, position }));
  for (const previous of historical) {
    if (!categories.some((category) => category.id === previous.id)) categories.push({ ...previous, archived: true });
  }
  const parentEntries = new Map(data.entries.map((entry) => [entry.id, entry]));
  const entries: TransactionRow[] = data.entries.map((entry, position) => {
    const wallet = wallets.find((wallet) => wallet.id === entry.wallet);
    const destination = wallets.find((wallet) => wallet.id === entry.toWallet);
    if (!wallet?.currencies.includes(entry.currency) || (entry.kind === "transfer" && !destination?.currencies.includes(entry.toCurrency!))) throw new Error("Invalid stored wallet reference.");
    let categoryId: string | null = null;
    if (entry.kind === "income" || entry.kind === "expense") {
      let category = categories.find((category) => category.id === entry.categoryId && category.kind === entry.kind && category.name === entry.category);
      category ??= categories.find((category) => !category.archived && category.name === entry.category && category.kind === entry.kind);
      category ??= categories.find((category) => category.name === entry.category && category.kind === entry.kind);
      if (!category) {
        let id = `historical:${entry.id}`;
        while (categories.some((category) => category.id === id)) id += ":historical";
        category = { userId, id, name: entry.category, kind: entry.kind, system: entry.transferId && entry.category === "Admin fees" ? "adminFees" : null, archived: true, position: categories.length };
        categories.push(category);
      }
      categoryId = category.id;
    }
    if (entry.transferId && parentEntries.get(entry.transferId)?.kind !== "transfer") throw new Error("Invalid stored transfer reference.");
    return {
      userId, id: entry.id, kind: entry.kind, date: new Date(entry.date).toISOString(), originalDate: entry.date,
      wallet: entry.wallet, currency: entry.currency, amount: entry.amount, title: entry.title,
      category: entry.category, categoryId, description: entry.description,
      toWallet: entry.toWallet ?? null, toCurrency: entry.toCurrency ?? null, received: entry.received ?? null,
      transferId: entry.transferId ?? null, exchangeRate: entry.exchangeRate ?? null,
      receipt: entry.receipt ? (() => { const receipt = { ...entry.receipt }; delete receipt.imageId; return receipt; })() : null, details: entry.details ?? null,
      searchText: [entry.title, entry.description, entry.category, wallet.name, entry.toWallet ? destination!.name : ""].join(" "), position,
    };
  });
  const imports: ImportRow[] = (data.receiptImports ?? []).map((record, position) => ({ userId, ...record, position }));
  ledgerBalances(data);
  return { wallets, categories, entries, imports };
}

// Compare the preserved export representation, ignoring only the new stable relationship.
export function comparableLedger(raw: unknown) {
  storedLedgerSchema.parse(raw);
  const data = structuredClone(raw) as Ledger;
  return { ...data, entries: data.entries.map((entry) => { const copy = { ...entry }; delete copy.categoryId; if (copy.receipt) delete copy.receipt.imageId; return copy; }), receiptImports: data.receiptImports ?? [] };
}
