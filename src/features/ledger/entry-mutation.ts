import type { Entry, Ledger } from "./ledger-model.ts";
import { money } from "./money.ts";
import { mutationCurrency, mutationText, mutationWallet } from "./mutation-input.ts";
import { setEntryCategory } from "./category-mutation.ts";
import { setEntryDetails } from "./entry-receipt.ts";
import { setTransfer } from "./transfer-mutation.ts";

function createEntry(data: Ledger, payload: Record<string, unknown>, existing?: Entry): Entry {
  if (payload.kind !== "income" && payload.kind !== "expense" && payload.kind !== "transfer") throw new Error("Invalid transaction type.");
  const currency = mutationCurrency(payload.currency);
  const date = mutationText(payload.date, "Date and time");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error("Invalid date and time.");
  return {
    id: existing?.id ?? crypto.randomUUID(), kind: payload.kind, date: new Date(date).toISOString(),
    wallet: mutationWallet(data, payload.wallet, currency), currency, amount: money(payload.amount, true),
    title: "Transfer", category: "", description: mutationText(payload.description ?? "", "Description", true),
  };
}

export function mutateEntry(data: Ledger, payload: Record<string, unknown>) {
  const existing = data.entries.find((entry) => entry.id === payload.id);
  if (payload.id && !existing) throw new Error("Transaction not found.");
  if (existing?.kind === "correction") throw new Error("Use the wallet balance to create a new correction.");
  if (existing?.transferId) throw new Error("Edit or delete this fee through its linked transfer.");
  if (payload.action === "deleteEntry") {
    if (!existing) throw new Error("Transaction not found.");
    data.entries = data.entries.filter((entry) => entry.id !== payload.id && entry.transferId !== payload.id);
    return;
  }
  const entry = createEntry(data, payload, existing);
  setEntryDetails(data, entry, payload, existing);
  let fee: Entry | undefined;
  if (entry.kind === "transfer") fee = setTransfer(data, entry, payload);
  else setEntryCategory(data, entry, payload, existing);
  data.entries = data.entries.filter((saved) => saved.id !== entry.id && saved.transferId !== entry.id)
    .concat(fee ? [entry, fee] : [entry]);
}
