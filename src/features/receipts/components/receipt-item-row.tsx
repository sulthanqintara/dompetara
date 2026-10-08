import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/features/ledger/components/editor/currency-input";
import type { Currency } from "@/features/ledger/ledger";
import type { Draft } from "../receipts";
export function ReceiptItemRow({
  item,
  currency,
  index,
  change,
  remove,
}: {
  currency: Currency;
  item: Draft["items"][number];
  index: number;
  change: (item: Draft["items"][number]) => void;
  remove: () => void;
}) {
  const t = useTranslations("UI");
  const prefix = `receipt-item-${index}`;
  return (
    <fieldset className="rounded-lg border p-3 min-w-0 space-y-2">
      <legend>{t("itemNumber", { number: index + 1 })}</legend>
      <Label htmlFor={`${prefix}-name`}>{t("name")}</Label>
      <Input
        id={`${prefix}-name`}
        value={item.name}
        required
        maxLength={1000}
        onChange={(e) => change({ ...item, name: e.target.value })}
      />
      <div className="form-row">
        <div>
          <Label htmlFor={`${prefix}-quantity`}>{t("quantity")}</Label>
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
          <Label htmlFor={`${prefix}-unit`}>{t("unitPriceOptional")}</Label>
          <CurrencyInput
            currency={currency}
            allowZero
            id={`${prefix}-unit`}
            inputMode="decimal"
            value={item.unitPrice ?? ""}
            onValueChange={(value) =>
              change({ ...item, unitPrice: value || null })
            }
          />
        </div>
      </div>
      <Label htmlFor={`${prefix}-total`}>{t("lineTotal")}</Label>
      <CurrencyInput
        currency={currency}
        allowZero
        id={`${prefix}-total`}
        inputMode="decimal"
        required
        value={item.lineTotal ?? ""}
        onValueChange={(value) => change({ ...item, lineTotal: value || null })}
      />
      <Button type="button" variant="secondary" onClick={remove}>
        {t("removeItemNumber", { number: index + 1 })}
      </Button>
    </fieldset>
  );
}
