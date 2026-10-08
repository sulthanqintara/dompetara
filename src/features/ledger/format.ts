import type { Currency } from "./ledger";

export function localDate(date = new Date(), timeZone?: string) {
  if (timeZone) {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date).replace(" ", "T")
      .replace(/^(\d{1,3})-/, (_, year: string) => `${year.padStart(4, "0")}-`);
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function format(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function formatShare(share: number) {
  if (share > 0 && share < 0.001) return "<0.1%";
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(share);
}

export function splitCurrencyAmount(value: string, currency: Currency, currencyDisplay: "symbol" | "code" = "symbol") {
  const symbol = new Intl.NumberFormat("en", { style: "currency", currency })
    .formatToParts(0).find((part) => part.type === "currency")!.value;
  const index = value.indexOf(symbol);
  if (index < 0) return { prefix: `${currency} `, amount: value };
  const end = index + symbol.length;
  const spacing = value.slice(end).match(/^\s*/)?.[0] ?? "";
  return { prefix: value.slice(0, index) + (currencyDisplay === "code" ? currency : symbol) + spacing, amount: value.slice(end + spacing.length) };
}
