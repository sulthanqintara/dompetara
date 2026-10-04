import type { Currency } from "./ledger.ts";

export function displayAmount(
  value: string,
  currency: Currency,
  fixed = false,
): string {
  if (!value) return "";
  const [whole, fraction] = value.split(".");
  const group = currency === "IDR" ? "." : ",";
  const decimal = currency === "IDR" ? "," : ".";
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (
    grouped +
    (fixed
      ? decimal + (fraction ?? "").padEnd(2, "0")
      : fraction !== undefined
        ? decimal + fraction
        : "")
  );
}

export function parseAmount(
  value: string,
  currency: Currency,
  allowNegative = false,
): string | null {
  const normalized =
    currency === "IDR"
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  if (
    !(allowNegative ? /^-?\d*(\.\d{0,2})?$/ : /^\d*(\.\d{0,2})?$/).test(
      normalized,
    )
  )
    return null;
  return normalized.replace(/^(-?)\./, "$10.").replace(/^(-?)0+(?=\d)/, "$1");
}
