import { categoryLabel } from "@/features/i18n/format";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import type { Ledger } from "../../ledger";
import { LedgerSelect } from "../shared/ledger-select";
import { ConfirmationDialog } from "../shared/confirmation-dialog";
import { useLedgerContext } from "../../use-ledger-context";

export function CategoriesSettings({
  data,
  pending,
  error,
  save,
}: {
  data: Ledger;
  pending: boolean;
  error: string;
  save: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const t = useTranslations("UI");
  const { conflict } = useLedgerContext();
  return (
    <Card className="settings-panel">
      <h3>{t("categories")}</h3>
      <form
        className="category-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          if (
            await save({
              action: "category",
              ...Object.fromEntries(new FormData(form)),
            })
          )
            form.reset();
        }}
      >
        <Label className="form-field">
          {t("categoryName")}
          <Input
            required
            name="name"
            maxLength={1000}
            placeholder={t("eGEntertainment")}
          />
        </Label>
        <LedgerSelect
          label={t("type")}
          name="kind"
          defaultValue="expense"
          options={[
            { value: "expense", label: t("expense") },
            { value: "income", label: t("income") },
          ]}
        />
        <Button type="submit" disabled={pending || conflict}>
          {t("addCategory")}
        </Button>
      </form>
      {(["income", "expense"] as const).map((kind) => (
        <div key={kind} className="category-group">
          <h4>{t(kind === "income" ? "incomeCategories" : "expenseCategories")}</h4>
          <div className="chips">
            {data.categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <ConfirmationDialog
                  key={c.id}
                  pending={pending}
                  error={error}
                  title={t("removeCategoryQuestion", { name: categoryLabel(data, c.name, t) })}
                  description={t("thisCategoryWillNoLongerBeAvailableForNewTransactionsPastTransactionsKeepTheirCategory")}
                  action={t("removeCategory")}
                  trigger={
                    <Pill
                      removable
                      aria-label={t("removeNamedCategory", { name: categoryLabel(data, c.name, t) })}
                      disabled={pending}
                    >
                      {categoryLabel(data, c.name, t)}
                    </Pill>
                  }
                  onConfirm={() => save({ action: "deleteCategory", id: c.id })}
                />
              ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
