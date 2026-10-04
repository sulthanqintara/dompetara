import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LedgerSelect } from "./ledger-select";

export function CategoryField({
  categories,
  category,
  suggestion,
}: {
  categories: { value: string; label: string }[];
  category?: string;
  suggestion?: { name: string; reason: string } | null;
}) {
  const id = useId();
  const match = categories.find(
    (category) =>
      category.value.toLowerCase() === suggestion?.name.toLowerCase(),
  );
  const [selected, setSelected] = useState(category ?? match?.value ?? "");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(suggestion?.name ?? "");
  return (
    <div className="category-field">
      {suggestion && (
        <Alert role="status" className="mb-3 break-words">
          <p>
            Suggested category:{" "}
            <strong>{match?.label ?? suggestion.name}</strong>
          </p>
          <p>{suggestion.reason}</p>
          {match ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setSelected(match.value);
              }}
            >
              Use suggested category
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setName(suggestion.name);
                setCreating(true);
              }}
            >
              Use new category
            </Button>
          )}
        </Alert>
      )}
      <input type="hidden" name="newCategory" value={String(creating)} />
      {creating ? (
        <div className="form-field">
          <Label htmlFor={id}>New category name</Label>
          <Input
            id={id}
            name="category"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={1000}
            required
          />
          <p className="hint">The category will be created when you save this transaction.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCreating(false)}
          >
            Choose an existing category
          </Button>
        </div>
      ) : (
        <>
          <LedgerSelect
            label="Category"
            name="category"
            required
            value={selected}
            onValueChange={setSelected}
            options={categories}
          />
          <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
            Add category
          </Button>
        </>
      )}
    </div>
  );
}
