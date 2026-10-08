import type { Currency } from "./ledger";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const amountFormatters = new Map<string, Intl.NumberFormat>();
const currencySymbols = new Map<string, string>();
const shareFormatters = new Map<string, Intl.NumberFormat>();

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

export function format(amount: number, currency: Currency, locale = "en") {
  const key = locale + ":" + currency;
  let formatter = amountFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // Currency defaults differ between the server and browser ICU versions.
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    amountFormatters.set(key, formatter);
  }
  return formatter.format(amount / 100);
}

export function formatShare(share: number, locale = "en") {
  let formatter = shareFormatters.get(locale);
  if (!formatter) { formatter = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }); shareFormatters.set(locale, formatter); }
  if (share > 0 && share < 0.001) return "<" + formatter.format(0.001);
  return formatter.format(share);
}

export function splitCurrencyAmount(value: string, currency: Currency, currencyDisplay: "symbol" | "code" = "symbol", locale = "en") {
  const key = locale + ":" + currency;
  let symbol = currencySymbols.get(key);
  if (!symbol) {
    symbol = new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0).find((part) => part.type === "currency")!.value;
    currencySymbols.set(key, symbol);
  }
  const index = value.indexOf(symbol);
  if (index < 0) return { prefix: `${currency} `, amount: value };
  const end = index + symbol.length;
  if (/\p{N}/u.test(value.slice(0, index))) return { prefix: (currencyDisplay === "code" ? currency : symbol) + " ", amount: (value.slice(0, index) + value.slice(end)).trim() };
  const spacing = value.slice(end).match(/^\s*/)?.[0] ?? "";
  return { prefix: value.slice(0, index) + (currencyDisplay === "code" ? currency : symbol) + spacing, amount: value.slice(end + spacing.length) };
}
