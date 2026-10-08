import type { Currency } from "./ledger";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const amountFormatters = new Map<Currency, Intl.NumberFormat>();
const currencySymbols = new Map<Currency, string>();
const shareFormatter = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

export function localDate(date = new Date(), timeZone?: string) {
  if (timeZone) {
    let formatter = dateFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      if (dateFormatters.size >= 32) dateFormatters.clear();
      dateFormatters.set(timeZone, formatter);
    }
    return formatter.format(date).replace(" ", "T")
      .replace(/^(\d{1,3})-/, (_, year: string) => `${year.padStart(4, "0")}-`);
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function format(amount: number, currency: Currency) {
  let formatter = amountFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      // Currency defaults differ between the server and browser ICU versions.
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    amountFormatters.set(currency, formatter);
  }
  return formatter.format(amount / 100);
}

export function formatShare(share: number) {
  if (share > 0 && share < 0.001) return "<0.1%";
  return shareFormatter.format(share);
}

export function splitCurrencyAmount(value: string, currency: Currency, currencyDisplay: "symbol" | "code" = "symbol") {
  let symbol = currencySymbols.get(currency);
  if (!symbol) {
    symbol = new Intl.NumberFormat("en", { style: "currency", currency })
      .formatToParts(0).find((part) => part.type === "currency")!.value;
    currencySymbols.set(currency, symbol);
  }
  const index = value.indexOf(symbol);
  if (index < 0) return { prefix: `${currency} `, amount: value };
  const end = index + symbol.length;
  const spacing = value.slice(end).match(/^\s*/)?.[0] ?? "";
  return { prefix: value.slice(0, index) + (currencyDisplay === "code" ? currency : symbol) + spacing, amount: value.slice(end + spacing.length) };
}
