import type { AppliedRate, RateSuggestion } from "../exchange-rates/exchange-rates.ts";
import type { Currency, Entry, Ledger } from "./ledger-model.ts";
import { convertedAmount, minorText, rateFromAmounts } from "./transfer.ts";

export type TransferOverride = (
  | { mode: "rate"; rate: string; source: AppliedRate["source"] }
  | { mode: "received"; received: string; source: "received" }
  | { mode: "saved"; rate: string; received: string; amount: string; source: AppliedRate["source"] }
) & { referenceDate?: string };

function initialTransferOverride(entry: Entry | undefined, crossCurrency: boolean): TransferOverride | null {
  if (!entry?.received || !crossCurrency) return null;
  const amount = minorText(entry.amount), received = minorText(entry.received);
  return {
    mode: "saved", amount, received,
    rate: entry.exchangeRate?.value ?? rateFromAmounts(amount, received),
    source: entry.exchangeRate?.source ?? "received",
    referenceDate: entry.exchangeRate?.referenceDate,
  };
}

export function initialTransferFields(data: Ledger, entry: Entry | undefined, currency: Currency, toCurrency: Currency, wallet: string) {
  const fee = entry ? data.entries.find((saved) => saved.transferId === entry.id) : undefined;
  return {
    feeAmount: fee ? minorText(fee.amount) : "",
    chargedTo: fee?.wallet === wallet && fee?.currency === currency ? "source" : "destination",
    override: initialTransferOverride(entry, currency !== toCurrency),
  };
}

function resolveTransferMode(amount: string, override: TransferOverride | null, suggestion: RateSuggestion | null) {
  if (!override) return { rate: suggestion?.rate ?? "", source: suggestion ? "ecb" : "manual", received: undefined, hideError: false } as const;
  switch (override.mode) {
    case "rate": return { rate: override.rate, source: override.source, received: undefined, hideError: false };
    case "received": return { rate: rateFromAmounts(amount, override.received), source: "received", received: override.received, hideError: true } as const;
    case "saved": {
      const unchanged = amount === override.amount;
      return {
        rate: unchanged ? override.rate : rateFromAmounts(amount, override.received),
        source: unchanged ? override.source : "received", received: override.received, hideError: unchanged,
      } as const;
    }
  }
}

export function transferConversion(amount: string, crossCurrency: boolean, override: TransferOverride | null, suggestion: RateSuggestion | null) {
  const mode = resolveTransferMode(amount, override, suggestion);
  const conversion = convertedAmount(amount, crossCurrency ? mode.rate : "1");
  return {
    rate: mode.rate, received: mode.received ?? conversion.value, source: mode.source,
    referenceDate: override?.referenceDate ?? suggestion?.rateDate ?? "",
    error: mode.hideError ? "" : conversion.error,
  };
}
