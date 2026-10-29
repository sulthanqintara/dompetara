"use client";

import { transactionFiltersHref } from "./transaction-filters";

export function applyTransactionFilters(values: Record<string, unknown>) {
  const href = transactionFiltersHref(values);
  if (`${window.location.pathname}${window.location.search}` !== href) {
    window.history.pushState(null, "", href);
  }
}
