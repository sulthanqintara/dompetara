import { currencies, type Currency } from "../ledger";

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
      <label>
        Period{" "}
        <input
          aria-label="Month"
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
        />
      </label>
      <label>
        Currency{" "}
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as Currency)}
        >
          {currencies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <span>Balances are kept in their original currency.</span>
    </div>
  );
}
