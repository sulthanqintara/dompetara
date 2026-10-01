import { currencies, type Currency } from "../ledger";
import { LedgerSelect } from "./ledger-select";
import { MonthPicker } from "./month-picker";

export function FiltersBar({
  month,
  currency,
  onMonthChange,
  onCurrencyChange,
}: {
  month: string;
  currency: Currency;
  onMonthChange: (month: string) => void;
  onCurrencyChange: (currency: Currency) => void;
}) {
  return (
    <div className="filters">
      <MonthPicker value={month} onChange={onMonthChange} />
      <LedgerSelect
        label="Currency"
        options={currencies.map((c) => ({ value: c, label: c }))}
        value={currency}
        onValueChange={(value) => onCurrencyChange(value as Currency)}
      />
      <span>Balances are kept in their original currency.</span>
    </div>
  );
}
