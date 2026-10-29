import { emptyLedger, type Entry } from "../../../src/features/ledger/ledger.ts";
import { ledgerQuery } from "../../../src/features/ledger/query.ts";
import { transactionPage } from "../../../src/features/ledger/pagination.ts";

const entry: Entry = { id: "lunch", kind: "expense", date: "2026-10-01T05:00:00Z", wallet: "bank", currency: "IDR", amount: 1234, title: "Fixture lunch", category: "Food & drink", description: "Personal note" };
export const viewData = { ...emptyLedger(), wallets: [{ id: "bank", name: "Fixture Bank", currencies: ["IDR" as const, "USD" as const] },
  { id: "cash", name: "Fixture Cash", currencies: ["IDR" as const] }], entries: [entry,
  { ...entry, id: "salary", kind: "income" as const, title: "Fixture salary", category: "Salary", amount: 5000 }] };
const viewQuery = ledgerQuery({ month: "2026-10" }, "Asia/Jakarta", "IDR");
export const viewInitial = { query: viewQuery, version: 1, result: { ...transactionPage(viewData.entries, "1"), related: viewData.entries } };
export const viewSummary = { query: { ...viewQuery, scope: "summary" as const }, version: 1,
  result: { totals: { income: 5000, expense: 1234 }, groups: [], daily: [], monthly: [] } };
