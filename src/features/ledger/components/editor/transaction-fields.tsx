import { useTranslations } from "next-intl";
import { categoryLabel } from "@/features/i18n/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Draft } from "@/features/receipts/receipts";
import type { Currency, Entry, Ledger } from "../../ledger";
import { entryCategories, initialTransactionDetails } from "../../entry-editor";
import { CategoryField } from "../shared/category-field";
import { TransactionDetails } from "./transaction-details";

export function TransactionFields({ entry, draft, kind, data, currency, amount }: {
  entry?: Entry; draft?: Draft; kind: Entry["kind"]; data: Ledger; currency: Currency; amount: string;
}) {
  const t = useTranslations("UI");
  const categories = entryCategories(data, kind, entry).map((name) => ({ value: name, label: categoryLabel(data, name, t) }));
  return <>
    <Label className="form-field">{t("title")}
      <Input name="title" required maxLength={1000} defaultValue={entry?.title ?? draft?.merchant ?? ""} placeholder={t("eGKaraokean")} />
    </Label>
    <CategoryField key={kind} category={entry?.kind === kind ? entry.category : undefined} suggestion={draft?.suggestedCategory} categories={categories} />
    <TransactionDetails currency={currency} amount={amount} initial={initialTransactionDetails(entry, draft)} />
  </>;
}
