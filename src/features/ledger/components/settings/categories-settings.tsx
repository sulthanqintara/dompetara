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
  const { conflict } = useLedgerContext();
  return (
    <Card className="settings-panel">
      <h3>Categories</h3>
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
          Category name
          <Input
            required
            name="name"
            maxLength={1000}
            placeholder="e.g. Entertainment"
          />
        </Label>
        <LedgerSelect
          label="Type"
          name="kind"
          defaultValue="expense"
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
        />
        <Button type="submit" disabled={pending || conflict}>
          Add category
        </Button>
      </form>
      {(["income", "expense"] as const).map((kind) => (
        <div key={kind} className="category-group">
          <h4>{kind} categories</h4>
          <div className="chips">
            {data.categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <ConfirmationDialog
                  key={c.id}
                  pending={pending}
                  error={error}
                  title={`Remove ${c.name}?`}
                  description="This category will no longer be available for new transactions. Past transactions keep their category."
                  action="Remove category"
                  trigger={
                    <Pill
                      removable
                      aria-label={`Remove ${c.name}`}
                      disabled={pending}
                    >
                      {c.name}
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
