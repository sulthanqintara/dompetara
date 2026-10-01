import type { Currency } from "./ledger";

export function localDate(date = new Date()) {
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
