import { useId, useState } from "react";
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
      {suggestion && !match && !creating && (
        <Button
          type="button"
          variant="secondary"
          className="mb-3 h-auto min-h-11 whitespace-normal break-words text-left"
          onClick={() => {
            setName(suggestion.name);
            setCreating(true);
          }}
        >
          Add category: {suggestion.name}
        </Button>
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
