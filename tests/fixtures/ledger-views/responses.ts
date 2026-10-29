import { ledgerQuerySchema } from "../../../src/features/ledger/query.ts";
import { filterTransactions } from "../../../src/features/ledger/transaction-filters.ts";
import { transactionPage } from "../../../src/features/ledger/pagination.ts";
import { viewData, viewSummary } from "./data.ts";

export function queryResponse(url: URL, failure: boolean) {
  if (failure) return { status: 500, json: { error: "Could not load your ledger. Please try again." } };
  const query = ledgerQuerySchema.parse(Object.fromEntries(url.searchParams));
  const rows = filterTransactions(viewData.entries, viewData, query);
  return { json: { query, version: 1, result: url.pathname.endsWith("/transactions")
    ? { ...transactionPage(rows, query.page), related: rows } : viewSummary.result } };
}

export function signOutResponse(failure: boolean) {
  if (failure) return { status: 500, json: { message: "Fixture auth failure", code: "UNKNOWN_ERROR" } };
  return { status: 200, json: { success: true } };
}
