import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Draft } from "../receipts";
export function ReceiptItemRow({
  item,
  index,
  change,
  remove,
}: {
  item: Draft["items"][number];
  index: number;
  change: (item: Draft["items"][number]) => void;
  remove: () => void;
}) {
  const prefix = `receipt-item-${index}`;
  return (
    <fieldset className="rounded-lg border p-3 min-w-0 space-y-2">
      <legend>Item {index + 1}</legend>
      <Label htmlFor={`${prefix}-name`}>Name</Label>
      <Input
        id={`${prefix}-name`}
        value={item.name}
        required
        maxLength={1000}
        onChange={(e) => change({ ...item, name: e.target.value })}
      />
      <div className="form-row">
        <div>
          <Label htmlFor={`${prefix}-quantity`}>Quantity</Label>
          <Input
            id={`${prefix}-quantity`}
            type="number"
            step="any"
            min="0.001"
            value={item.quantity ?? ""}
            onChange={(e) =>
              change({
                ...item,
                quantity: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}-unit`}>Unit price (optional)</Label>
          <Input
            id={`${prefix}-unit`}
            inputMode="decimal"
            value={item.unitPrice ?? ""}
            onChange={(e) =>
              change({ ...item, unitPrice: e.target.value || null })
            }
          />
        </div>
      </div>
      <Label htmlFor={`${prefix}-total`}>Line total</Label>
      <Input
        id={`${prefix}-total`}
        inputMode="decimal"
        required
        value={item.lineTotal ?? ""}
        onChange={(e) => change({ ...item, lineTotal: e.target.value || null })}
      />
      <Button type="button" variant="secondary" onClick={remove}>
        Remove item {index + 1}
      </Button>
    </fieldset>
  );
}
