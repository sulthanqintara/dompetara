import { currencies, type Currency } from "../../ledger";
import { LedgerSelect } from "../shared/ledger-select";
import type { Period } from "../../derive";
import { PeriodPicker } from "./period-picker";
import { MobileSummaryFilters } from "./mobile-summary-filters";

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
    <>
    <div className="mobile-summary-controls">
      <MobileSummaryFilters period={period} currency={currency}
        onPeriodChange={onPeriodChange} onCurrencyChange={onCurrencyChange} />
    </div>
    <div className="filters desktop-summary-controls">
      <PeriodPicker key={JSON.stringify(period)} period={period} onChange={onPeriodChange} />
      <LedgerSelect
        label="Currency"
        options={currencies.map((c) => ({ value: c, label: c }))}
        value={currency}
        onValueChange={(value) => onCurrencyChange(value as Currency)}
      />
    </div>
    </>
  );
}
