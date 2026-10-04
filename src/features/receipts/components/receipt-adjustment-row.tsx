import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/features/ledger/components/editor/currency-input";
import type { Currency } from "@/features/ledger/ledger";
import type { Draft } from "../receipts";
export function ReceiptAdjustmentRow({
  adjustment,
  currency,
  index,
  change,
  remove,
}: {
  currency: Currency;
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
      <CurrencyInput
        currency={currency}
        allowNegative
        allowZero
        id={`adjustment-${index}-amount`}
        required
        inputMode="decimal"
        value={adjustment.amount}
        onValueChange={(value) => change({ ...adjustment, amount: value })}
      />
      <Button type="button" variant="secondary" onClick={remove}>
        Remove adjustment {index + 1}
      </Button>
    </fieldset>
  );
}
