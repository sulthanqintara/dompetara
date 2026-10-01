import { currencies, type Currency } from "../ledger";
import { LedgerSelect } from "./ledger-select";
import type { Period } from "../derive";
import { PeriodPicker } from "./period-picker";

export function FiltersBar({
  period,
  currency,
  onPeriodChange,
  onCurrencyChange,
}: {
  period: Period;
  currency: Currency;
  onPeriodChange: (period: Period) => void;
  onCurrencyChange: (currency: Currency) => void;
}) {
  return (
    <div className="filters">
      <PeriodPicker period={period} onChange={onPeriodChange} />
      <LedgerSelect
        label="Currency"
        options={currencies.map((c) => ({ value: c, label: c }))}
        value={currency}
        onValueChange={(value) => onCurrencyChange(value as Currency)}
      />
      <span>Income and expenses use this currency; current balance includes converted wallets.</span>
    </div>
  );
}
