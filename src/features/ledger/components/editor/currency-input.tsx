import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import type { Currency } from "../../ledger";
import { displayAmount, parseAmount } from "../../currency-input";

export function CurrencyInput({
  currency,
  name,
  value,
  onValueChange,
  allowZero = false,
  allowNegative = false,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  currency: Currency;
  value: string;
  onValueChange: (value: string) => void;
  allowZero?: boolean;
  allowNegative?: boolean;
}) {
  const t = useTranslations("UI");
  const [focused, setFocused] = useState(false);
  const displayed = displayAmount(value, currency, !focused);
  return (
    <span className="currency-input">
      <span aria-hidden="true">{currency === "IDR" ? "Rp" : currency}</span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayed}
        placeholder={currency === "IDR" ? "0,00" : "0.00"}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (!props.readOnly && value && Number.isFinite(Number(value))) {
            const [whole, fraction = ""] = value.split(".");
            onValueChange(`${whole || "0"}.${fraction.padEnd(2, "0")}`);
          }
        }}
        onChange={(event) => {
          const input = event.target;
          const next = parseAmount(input.value, currency, allowNegative);
          if (next === null) return;
          const count = input.value
            .slice(0, input.selectionStart ?? 0)
            .replace(currency === "IDR" ? /\./g : /,/g, "").length;
          onValueChange(next);
          requestAnimationFrame(() => {
            const formatted = displayAmount(next, currency);
            let position = 0;
            let characters = 0;
            while (position < formatted.length && characters < count) {
              if (formatted[position] !== (currency === "IDR" ? "." : ","))
                characters++;
              position++;
            }
            input.setSelectionRange(position, position);
          });
        }}
        ref={(input) => {
          input?.setCustomValidity(
            value &&
              (!Number.isFinite(Number(value)) ||
                (!allowNegative && Number(value) < (allowZero ? 0 : 0.01)) ||
                Math.abs(Number(value)) > 999999999999.99)
              ? t("enterAnAmountWithinTheAllowedRange")
              : "",
          );
        }}
      />
      <input type="hidden" name={name} value={value} />
    </span>
  );
}
