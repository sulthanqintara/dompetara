import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Draft } from "../receipts";
export function ReceiptAdjustmentRow({
  adjustment,
  index,
  change,
  remove,
}: {
  adjustment: Draft["adjustments"][number];
  index: number;
  change: (item: Draft["adjustments"][number]) => void;
  remove: () => void;
}) {
  return (
    <fieldset className="rounded-lg border p-3 min-w-0 space-y-2">
      <legend>Adjustment {index + 1}</legend>
      <Label htmlFor={`adjustment-${index}-label`}>
        Tax, service, discount or rounding
      </Label>
      <Input
        id={`adjustment-${index}-label`}
        required
        value={adjustment.label}
        onChange={(e) => change({ ...adjustment, label: e.target.value })}
      />
      <Label htmlFor={`adjustment-${index}-amount`}>
        Amount (negative for discounts)
      </Label>
      <Input
        id={`adjustment-${index}-amount`}
        required
        inputMode="decimal"
        value={adjustment.amount}
        onChange={(e) => change({ ...adjustment, amount: e.target.value })}
      />
      <Button type="button" variant="secondary" onClick={remove}>
        Remove adjustment {index + 1}
      </Button>
    </fieldset>
  );
}
