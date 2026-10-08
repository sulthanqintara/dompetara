import { useTranslations } from "next-intl";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SelectTrigger } from "@/components/ui/select-trigger";
import { SelectValue } from "@/components/ui/select-value";
import { SelectContent } from "@/components/ui/select-content";
import { SelectItem } from "@/components/ui/select-item";

export function LedgerSelect({
  label,
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  required,
  disabled,
  compact = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("UI");
  const id = useId();
  return (
    <div className="form-field">
      <Label htmlFor={id} className={compact ? "sr-only" : undefined}>{label}</Label>
      <Select
        items={options}
        name={name}
        value={value === undefined ? undefined : value || null}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== null) onValueChange?.(value);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? t("chooseAnOption")} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
