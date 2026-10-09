import { money } from "./money.ts";
import { assertLedgerGrowth, assertLedgerLimits } from "./ledger-limits.ts";
export { money } from "./money.ts";
import {
  receiptSchema,
  transactionDetailsSchema,
  validateTransactionDetails,
  type TransactionDetails,
  validateReceipt,
  type Receipt,
} from "../receipts/receipts.ts";
import {
  effectiveRate,
  normalizeRate,
  validRateDate,
  type AppliedRate,
} from "../exchange-rates/exchange-rates.ts";

export const currencies = ["IDR", "USD", "CAD"] as const;
export type Currency = (typeof currencies)[number];
export type Wallet = { id: string; name: string; currencies: Currency[] };
export type Category = { id: string; name: string; kind: "income" | "expense"; system?: "adminFees" };
export type Entry = {
  id: string;
  kind: "income" | "expense" | "transfer" | "correction";
  date: string;
  wallet: string;
  currency: Currency;
  amount: number;
  title: string;
  category: string;
  description: string;
  toWallet?: string;
  toCurrency?: Currency;
  received?: number;
  exchangeRate?: AppliedRate;
  transferId?: string;
  receipt?: Receipt;
  details?: TransactionDetails;
};
export type Ledger = {
  wallets: Wallet[];
  categories: Category[];
  entries: Entry[];
  receiptImports?: { importId: string; fingerprint: string; entryId: string }[];
};
export function emptyLedger(): Ledger {
  return {
    wallets: [],
    entries: [],
    categories: ["Salary", "Other income"]
      .map<Category>((name) => ({ id: name, name, kind: "income" }))
      .concat(
        ["Food & drink", "Transport", "Entertainment", "Shopping", "Bills"].map(
          (name) => ({ id: name, name, kind: "expense" as const }),
        ),
      ),
  };
}
export function balance(
  data: Ledger,
  wallet: string,
  currency: Currency,
): number {
  let total = 0;
  for (const e of data.entries) {
    if (e.wallet === wallet && e.currency === currency)
      total +=
        e.kind === "expense" || e.kind === "transfer" ? -e.amount : e.amount;
    if (
      e.kind === "transfer" &&
      e.toWallet === wallet &&
      e.toCurrency === currency
    )
      total += e.received!;
    if (!Number.isSafeInteger(total))
      throw new Error("Balance exceeds supported amount.");
  }
  return total;
}

export function ledgerBalances(data: Ledger) {
  const totals = new Map(
    data.wallets.map((wallet) => [
      wallet.id,
      new Map<Currency, number>(wallet.currencies.map((currency) => [currency, 0])),
    ]),
  );
  for (const entry of data.entries) {
    const source = totals.get(entry.wallet);
    const destination = entry.kind === "transfer" ? totals.get(entry.toWallet!) : undefined;
    if (source?.has(entry.currency)) {
      let total = source.get(entry.currency)! +
        (entry.kind === "expense" || entry.kind === "transfer" ? -entry.amount : entry.amount);
      if (destination === source && entry.toCurrency === entry.currency)
        total += entry.received!;
      if (!Number.isSafeInteger(total)) throw new Error("Balance exceeds supported amount.");
      source.set(entry.currency, total);
    }
    if (
      destination?.has(entry.toCurrency!) &&
      !(destination === source && entry.toCurrency === entry.currency)
    ) {
      const total = destination.get(entry.toCurrency!)! + entry.received!;
      if (!Number.isSafeInteger(total)) throw new Error("Balance exceeds supported amount.");
      destination.set(entry.toCurrency!, total);
    }
  }
  return totals;
}
function text(value: unknown, label: string, optional = false) {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    (!optional && !value.trim())
  )
    throw new Error(`${label} is required (maximum 1,000 characters).`);
  return value.trim();
}
export function mutateLedger(previous: Ledger, raw: unknown): Ledger {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid request.");
  const p = raw as Record<string, unknown>;
  if (p.action === "removeReceiptImage") {
    const data = structuredClone(previous);
    const entry = data.entries.find((entry) => entry.id === p.id);
    if (!entry?.receipt) throw new Error("Receipt not found.");
    delete entry.receipt.imageId;
    assertLedgerLimits(previous, data);
    return data;
  }
  if (p.action === "receipt") {
    const receipt = receiptSchema.parse(p.receipt);
    if (
      previous.receiptImports?.some(
        (saved) =>
          saved.importId === receipt.importId ||
          saved.fingerprint === receipt.fingerprint,
      )
    )
      return structuredClone(previous);
    assertLedgerGrowth(previous, "receiptImports", 1);
    const result = mutateLedger(previous, {
      ...p,
      action: "entry",
      id: undefined,
      receipt,
    });
    result.receiptImports = [
      ...(previous.receiptImports ?? []),
      {
        importId: receipt.importId,
        fingerprint: receipt.fingerprint,
        entryId: result.entries.at(-1)!.id,
      },
    ];
    assertLedgerLimits(previous, result);
    return result;
  }
  // Reject obvious count growth before copying or scanning a large saved ledger.
  if (p.action === "wallet" && !p.id) {
    assertLedgerGrowth(previous, "wallets", 1);
    assertLedgerGrowth(previous, "entries", 1);
  }
  if (p.action === "category") assertLedgerGrowth(previous, "categories", 1);
  if (p.action === "entry" && !p.id) assertLedgerGrowth(previous, "entries", 1);
  const data = structuredClone(previous);
  const currency = (v: unknown): Currency => {
    if (!currencies.includes(v as Currency))
      throw new Error("Choose a supported currency.");
    return v as Currency;
  };
  const wallet = (id: unknown, c: Currency) => {
    const w = data.wallets.find((w) => w.id === id);
    if (!w || !w.currencies.includes(c))
      throw new Error("Choose a wallet with this currency.");
    return w.id;
  };
  if (p.action === "wallet") {
    const name = text(p.name, "Wallet name");
    if (p.id) {
      const w = data.wallets.find((w) => w.id === p.id);
      if (!w) throw new Error("Wallet not found.");
      w.name = name;
    } else data.wallets.push({ id: crypto.randomUUID(), name, currencies: [] });
    const w = p.id
      ? data.wallets.find((w) => w.id === p.id)!
      : data.wallets.at(-1)!;
    const c = currency(p.currency);
    const target = money(p.amount);
    const delta = target - balance(data, w.id, c);
    if (!Number.isSafeInteger(delta)) throw new Error("Balance exceeds supported amount.");
    const opening = !w.currencies.includes(c);
    if (opening) w.currencies.push(c);
    if (delta || opening)
      data.entries.push({
        id: crypto.randomUUID(),
        kind: "correction",
        date: new Date().toISOString(),
        wallet: w.id,
        currency: c,
        amount: delta,
        title: opening ? "Opening balance" : "Balance correction",
        category: "",
        description: "",
      });
  } else if (p.action === "deleteWallet") {
    if (data.entries.some((e) => e.wallet === p.id || e.toWallet === p.id))
      throw new Error("Wallets with ledger history cannot be deleted.");
    data.wallets = data.wallets.filter((w) => w.id !== p.id);
  } else if (p.action === "category") {
    const name = text(p.name, "Category name");
    if (p.kind !== "income" && p.kind !== "expense")
      throw new Error("Invalid category type.");
    if (
      data.categories.some(
        (c) => c.kind === p.kind && c.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new Error("This category already exists.");
    data.categories.push({ id: crypto.randomUUID(), name, kind: p.kind });
  } else if (p.action === "deleteCategory") {
    data.categories = data.categories.filter((c) => c.id !== p.id);
  } else if (p.action === "entry" || p.action === "deleteEntry") {
    const existing = data.entries.find((e) => e.id === p.id);
    if (p.id && !existing) throw new Error("Transaction not found.");
    if (existing?.kind === "correction")
      throw new Error("Use the wallet balance to create a new correction.");
    if (existing?.transferId)
      throw new Error("Edit or delete this fee through its linked transfer.");
    if (p.action === "deleteEntry") {
      if (!existing) throw new Error("Transaction not found.");
      data.entries = data.entries.filter(
        (e) => e.id !== p.id && e.transferId !== p.id,
      );
    } else {
      if (p.kind !== "income" && p.kind !== "expense" && p.kind !== "transfer")
        throw new Error("Invalid transaction type.");
      const c = currency(p.currency);
      const date = text(p.date, "Date and time");
      if (
        !/^\d{4}-\d{2}-\d{2}T/.test(date) ||
        !Number.isFinite(Date.parse(date))
      )
        throw new Error("Invalid date and time.");
      const e: Entry = {
        id: existing?.id ?? crypto.randomUUID(),
        kind: p.kind,
        date: new Date(date).toISOString(),
        wallet: wallet(p.wallet, c),
        currency: c,
        amount: money(p.amount, true),
        title: "Transfer",
        category: "",
        description: text(p.description ?? "", "Description", true),
      };
      if (e.kind !== "transfer" && (p.details || existing?.details)) {
        e.details = transactionDetailsSchema.parse(p.details ?? existing?.details);
        validateTransactionDetails(e.details, e.amount);
      }
      if (p.receipt || existing?.receipt) {
        if (e.kind !== "expense")
          throw new Error("A receipt must be saved as an expense.");
        e.receipt = receiptSchema.parse({ ...(p.receipt ?? existing?.receipt) as Receipt, ...(e.details ?? {}) });
        // Keep byte validation aligned with the image references the server saves.
        delete e.receipt.imageId;
        if (existing?.receipt?.imageId && p.removeReceiptImage !== true)
          e.receipt.imageId = existing.receipt.imageId;
        validateReceipt(e.receipt, e.amount);
        if (
          !existing &&
          data.entries.some(
            (entry) => entry.receipt?.fingerprint === e.receipt?.fingerprint,
          )
        )
          throw new Error("This image has already been imported.");
      }
      let fee: Entry | undefined;
      if (p.kind === "transfer") {
        e.toCurrency = currency(p.toCurrency);
        e.toWallet = wallet(p.toWallet, e.toCurrency);
        if (e.wallet === e.toWallet && e.currency === e.toCurrency)
          throw new Error("Choose a different destination balance.");
        e.received =
          e.currency === e.toCurrency ? e.amount : money(p.received, true);
        if (e.currency !== e.toCurrency) {
          const value = p.exchangeRate
            ? normalizeRate(p.exchangeRate)
            : effectiveRate(e.amount, e.received);
          const source = p.exchangeRate
            ? (p.rateSource ?? "manual")
            : "received";
          if (source !== "manual" && source !== "received" && source !== "ecb")
            throw new Error("Invalid exchange-rate source.");
          if (source === "ecb" && !validRateDate(p.referenceDate))
            throw new Error("Invalid reference-rate date.");
          e.exchangeRate = {
            value,
            source,
            ...(source === "ecb"
              ? { referenceDate: p.referenceDate as string }
              : {}),
          };
        }
        const feeAmount = money(p.feeAmount || "0");
        if (feeAmount < 0) throw new Error("Service fee cannot be negative.");
        if (feeAmount) {
          if (p.feeChargedTo !== "source" && p.feeChargedTo !== "destination")
            throw new Error("Choose which wallet pays the service fee.");
          const destination = p.feeChargedTo === "destination";
          if (destination && feeAmount >= e.received)
            throw new Error(
              "Destination fee must be less than the amount received.",
            );
          let category = data.categories.find(
            (c) =>
              c.kind === "expense" && c.name.toLowerCase() === "admin fees",
          );
          if (!category) {
            category = {
              id: crypto.randomUUID(),
              name: "Admin fees",
              system: "adminFees",
              kind: "expense",
            };
            data.categories.push(category);
          }
          fee = {
            id:
              data.entries.find((entry) => entry.transferId === e.id)?.id ??
              crypto.randomUUID(),
            kind: "expense",
            transferId: e.id,
            date: e.date,
            wallet: destination ? e.toWallet : e.wallet,
            currency: destination ? e.toCurrency : e.currency,
            amount: feeAmount,
            title: "Transfer service fee",
            category: category.name,
            description: "",
          };
        }
      } else {
        e.title = text(p.title, "Title");
        e.category = text(p.category, "Category");
        if (p.newCategory === true) {
          if (e.kind !== "income" && e.kind !== "expense")
            throw new Error("Categories must belong to income or expense.");
          const match = data.categories.find(
            (category) =>
              category.kind === e.kind &&
              category.name.toLowerCase() === e.category.toLowerCase(),
          );
          if (match) e.category = match.name;
          else
            data.categories.push({
              id: crypto.randomUUID(),
              name: e.category,
              kind: e.kind,
            });
        }
        if (
          !data.categories.some(
            (c) => c.name === e.category && c.kind === e.kind,
          ) &&
          !(existing?.category === e.category && existing.kind === e.kind)
        )
          throw new Error("Choose an available category.");
      }
      data.entries = data.entries
        .filter((entry) => entry.id !== e.id && entry.transferId !== e.id)
        .concat(fee ? [e, fee] : [e]);
    }
  } else throw new Error("Unknown action.");
  assertLedgerLimits(previous, data);
  ledgerBalances(data);
  return data;
}
