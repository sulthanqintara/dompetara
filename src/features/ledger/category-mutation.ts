import type { Entry, Ledger } from "./ledger-model.ts";
import { mutationText } from "./mutation-input.ts";

export function saveCategory(data: Ledger, payload: Record<string, unknown>) {
  const name = mutationText(payload.name, "Category name");
  if (payload.kind !== "income" && payload.kind !== "expense") throw new Error("Invalid category type.");
  if (data.categories.some((category) => category.kind === payload.kind && category.name.toLowerCase() === name.toLowerCase()))
    throw new Error("This category already exists.");
  data.categories.push({ id: crypto.randomUUID(), name, kind: payload.kind });
}

export function setEntryCategory(data: Ledger, entry: Entry, payload: Record<string, unknown>, existing?: Entry) {
  entry.title = mutationText(payload.title, "Title");
  entry.category = mutationText(payload.category, "Category");
  const unchanged = existing?.kind === entry.kind && existing.category === entry.category;
  if (unchanged && existing.categoryId) entry.categoryId = existing.categoryId;
  if (payload.newCategory === true) {
    if (entry.kind !== "income" && entry.kind !== "expense") throw new Error("Categories must belong to income or expense.");
    const match = data.categories.find((category) => category.kind === entry.kind && category.name.toLowerCase() === entry.category.toLowerCase());
    if (match) entry.category = match.name;
    else data.categories.push({ id: crypto.randomUUID(), name: entry.category, kind: entry.kind });
  }
  const available = data.categories.some((category) => category.name === entry.category && category.kind === entry.kind);
  // Archived category names remain valid on their existing transactions.
  if (!available && !(existing?.category === entry.category && existing.kind === entry.kind))
    throw new Error("Choose an available category.");
}
