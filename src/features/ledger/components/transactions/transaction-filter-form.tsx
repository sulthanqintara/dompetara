"use client";

import Form from "next/form";
import type { ComponentProps } from "react";
import { applyTransactionFilters } from "../../apply-transaction-filters";

export function TransactionFilterForm({ onApplied, ...props }: Pick<ComponentProps<"form">, "children" | "className" | "aria-label"> & {
  onApplied?: () => void;
}) {
  return <Form {...props} action="/transactions" scroll={false} onSubmit={(event) => {
    event.preventDefault();
    applyTransactionFilters(Object.fromEntries(new FormData(event.currentTarget)));
    onApplied?.();
  }} />;
}
