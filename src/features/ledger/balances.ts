import { convertBalanceMinor, type RateSuggestion } from "../exchange-rates/exchange-rates.ts";
import { balance, currencies, type Currency, type Ledger } from "./ledger.ts";

export function balanceBreakdown(data: Ledger, target: Currency, rates: Partial<Record<Currency, RateSuggestion | null>>) {
  const rows = currencies.filter((currency) => currency === target || data.wallets.some((wallet) => wallet.currencies.includes(currency))).map((currency) => {
    const amount = data.wallets.reduce((sum, wallet) => sum + balance(data, wallet.id, currency), 0);
    const suggestion = rates[currency];
    let converted: number | null = null;
    try {
      if (!Number.isSafeInteger(amount)) throw new Error("Unsupported balance.");
      converted = currency === target || amount === 0 ? amount : suggestion ? convertBalanceMinor(amount, suggestion.rate) : null;
    } catch {
      converted = null;
    }
    return { currency, amount, converted, suggestion: currency !== target && amount !== 0 ? suggestion : null };
  });
  const dates = new Set(rows.flatMap((row) => row.suggestion ? [row.suggestion.rateDate] : []));
  const sum = rows.reduce((total, row) => total + (row.converted ?? 0), 0);
  const total = rows.every((row) => row.converted !== null) && dates.size <= 1 && Number.isSafeInteger(sum) ? sum : null;
  return { rows, total, dates: [...dates], stale: rows.some((row) => row.suggestion?.stale) };
}
