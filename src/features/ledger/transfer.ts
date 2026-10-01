import {
  convertMinor,
  effectiveRate,
} from "../exchange-rates/exchange-rates.ts";
import { money, type Entry, type Ledger } from "./ledger.ts";

export function receivedAfterFee(data: Ledger, transfer: Entry): number {
  const fee = data.entries.find((entry) => entry.transferId === transfer.id);
  return (
    (transfer.received ?? 0) -
    (fee &&
    fee.wallet === transfer.toWallet &&
    fee.currency === transfer.toCurrency
      ? fee.amount
      : 0)
  );
}

export function convertedAmount(
  amount: string,
  rate: string,
): { value: string; error: string } {
  if (!amount || !rate) return { value: "", error: "" };
  try {
    return {
      value: minorText(convertMinor(money(amount, true), rate)),
      error: "",
    };
  } catch (error) {
    return {
      value: "",
      error: error instanceof Error ? error.message : "Invalid conversion.",
    };
  }
}

export function rateFromAmounts(amount: string, received: string): string {
  try {
    return effectiveRate(money(amount, true), money(received, true));
  } catch {
    return "";
  }
}

export function minorText(amount: number): string {
  return `${amount < 0 ? "-" : ""}${Math.trunc(Math.abs(amount) / 100)}.${Math.abs(
    amount % 100,
  )
    .toString()
    .padStart(2, "0")}`;
}

export function transferTotals(
  amount: string,
  received: string,
  fee: string,
  destination: boolean,
) {
  try {
    const sent = money(amount || "0");
    const credit = money(received || "0");
    const charge = money(fee || "0");
    return {
      debit: sent + (destination ? 0 : charge),
      credit: credit - (destination ? charge : 0),
    };
  } catch {
    return null;
  }
}
