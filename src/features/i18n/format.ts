import type { Ledger, Entry } from "../ledger/ledger";

const defaultCategories: Record<string, string> = {
  Salary: "salary", "Other income": "otherIncome", "Food & drink": "foodDrink",
  Transport: "transport", Entertainment: "entertainment", Shopping: "shopping", Bills: "bills",
};

export function categoryLabel(data: Pick<Ledger, "categories" | "entries">, name: string, t: (key: string) => string) {
  const category = data.categories.find((category) => category.name === name);
  const isFee = category?.system === "adminFees" || (name === "Admin fees" && data.entries.some((entry) => entry.transferId && entry.category === name));
  const key = isFee ? "adminFees"
    : category?.id === name ? defaultCategories[name] : undefined;
  return key ? t(key) : name;
}

export function entryTitle(entry: Entry, t: (key: string) => string) {
  if (entry.kind === "transfer") return t("transfer");
  if (entry.transferId) return t("transferServiceFee");
  if (entry.kind === "correction" && entry.title === "Opening balance") return t("openingBalance");
  if (entry.kind === "correction" && entry.title === "Balance correction") return t("balanceCorrection");
  return entry.title;
}
