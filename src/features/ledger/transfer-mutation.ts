import { effectiveRate, normalizeRate, validRateDate, type AppliedRate } from "../exchange-rates/exchange-rates.ts";
import type { Entry, Ledger } from "./ledger-model.ts";
import { money } from "./money.ts";
import { mutationCurrency, mutationWallet } from "./mutation-input.ts";

function appliedTransferRate(entry: Entry, payload: Record<string, unknown>): AppliedRate {
  const value = payload.exchangeRate ? normalizeRate(payload.exchangeRate) : effectiveRate(entry.amount, entry.received!);
  const source = payload.exchangeRate ? (payload.rateSource ?? "manual") : "received";
  if (source !== "manual" && source !== "received" && source !== "ecb") throw new Error("Invalid exchange-rate source.");
  if (source === "ecb") {
    if (!validRateDate(payload.referenceDate)) throw new Error("Invalid reference-rate date.");
    return { value, source, referenceDate: payload.referenceDate };
  }
  return { value, source };
}

function transferFee(data: Ledger, entry: Entry, payload: Record<string, unknown>): Entry | undefined {
  const amount = money(payload.feeAmount || "0");
  if (amount < 0) throw new Error("Service fee cannot be negative.");
  if (!amount) return;
  if (payload.feeChargedTo !== "source" && payload.feeChargedTo !== "destination")
    throw new Error("Choose which wallet pays the service fee.");
  const destination = payload.feeChargedTo === "destination";
  if (destination && amount >= entry.received!) throw new Error("Destination fee must be less than the amount received.");
  let category = data.categories.find((category) => category.kind === "expense" && category.name.toLowerCase() === "admin fees");
  if (!category) {
    category = { id: crypto.randomUUID(), name: "Admin fees", system: "adminFees", kind: "expense" };
    data.categories.push(category);
  }
  return {
    id: data.entries.find((saved) => saved.transferId === entry.id)?.id ?? crypto.randomUUID(),
    kind: "expense", transferId: entry.id, date: entry.date,
    wallet: destination ? entry.toWallet! : entry.wallet,
    currency: destination ? entry.toCurrency! : entry.currency,
    amount, title: "Transfer service fee", category: category.name, description: "",
  };
}

export function setTransfer(data: Ledger, entry: Entry, payload: Record<string, unknown>) {
  entry.toCurrency = mutationCurrency(payload.toCurrency);
  entry.toWallet = mutationWallet(data, payload.toWallet, entry.toCurrency);
  if (entry.wallet === entry.toWallet && entry.currency === entry.toCurrency)
    throw new Error("Choose a different destination balance.");
  entry.received = entry.currency === entry.toCurrency ? entry.amount : money(payload.received, true);
  if (entry.currency !== entry.toCurrency) entry.exchangeRate = appliedTransferRate(entry, payload);
  return transferFee(data, entry, payload);
}
