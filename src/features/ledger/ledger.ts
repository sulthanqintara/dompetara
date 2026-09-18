export const currencies = ["IDR", "USD", "CAD"] as const;
export type Currency = (typeof currencies)[number];
export type Wallet = { id: string; name: string; currencies: Currency[] };
export type Category = { id: string; name: string; kind: "income" | "expense" };
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
};
export type Ledger = {
  wallets: Wallet[];
  categories: Category[];
  entries: Entry[];
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
export function money(value: unknown, positive = false): number {
  if (typeof value !== "string" || !/^-?\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a valid amount with at most two decimal places.");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (value.startsWith("-") ? -1 : 1);
  if (positive && result <= 0)
    throw new Error("Amount must be greater than zero.");
  return result;
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
    if (p.action === "deleteEntry") {
      if (!existing) throw new Error("Transaction not found.");
      data.entries = data.entries.filter((e) => e.id !== p.id);
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
      if (p.kind === "transfer") {
        e.toCurrency = currency(p.toCurrency);
        e.toWallet = wallet(p.toWallet, e.toCurrency);
        if (e.wallet === e.toWallet && e.currency === e.toCurrency)
          throw new Error("Choose a different destination balance.");
        e.received =
          e.currency === e.toCurrency ? e.amount : money(p.received, true);
      } else {
        e.title = text(p.title, "Title");
        e.category = text(p.category, "Category");
        if (
          !data.categories.some(
            (c) => c.name === e.category && c.kind === e.kind,
          ) &&
          !(existing?.category === e.category && existing.kind === e.kind)
        )
          throw new Error("Choose an available category.");
      }
      data.entries = data.entries
        .filter((entry) => entry.id !== e.id)
        .concat(e);
    }
  } else throw new Error("Unknown action.");
  for (const w of data.wallets)
    for (const c of w.currencies) balance(data, w.id, c);
  return data;
}
