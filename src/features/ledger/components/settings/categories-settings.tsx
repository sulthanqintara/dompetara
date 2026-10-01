import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Ledger } from "../../ledger";
import { LedgerSelect } from "../shared/ledger-select";
import { ConfirmationDialog } from "../shared/confirmation-dialog";

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
  return (
    <Card className="settings-panel">
      <h3>Categories</h3>
      <p>Removing a category keeps it on past transactions.</p>
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
        <Button type="submit" disabled={pending}>
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
                <Badge variant="secondary" className="category-pill" key={c.id}>
                  <span>{c.name}</span>
                  <ConfirmationDialog
                    pending={pending}
                    error={error}
                    title={`Remove ${c.name}?`}
                    description="This category will no longer be available for new transactions. Past transactions keep their category."
                    action="Remove category"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${c.name}`}
                        disabled={pending}
                      >
                        <X />
                      </Button>
                    }
                    onConfirm={() =>
                      save({ action: "deleteCategory", id: c.id })
                    }
                  />
                </Badge>
              ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
