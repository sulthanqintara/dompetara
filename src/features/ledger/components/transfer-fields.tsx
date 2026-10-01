import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import type { AppliedRate } from "@/features/exchange-rates/exchange-rates";
import type { Currency, Entry, Ledger } from "../ledger";
import { format } from "../format";
import {
  convertedAmount,
  minorText,
  rateFromAmounts,
  transferTotals,
} from "../transfer";
import { LedgerSelect } from "./ledger-select";

export function TransferFields({
  entry,
  data,
  currency,
  toCurrency,
  wallet,
  toWallet,
  amount,
  date,
}: {
  entry?: Entry;
  data: Ledger;
  currency: Currency;
  toCurrency: Currency;
  wallet: string;
  toWallet: string;
  amount: string;
  date: string;
}) {
  const id = useId();
  const crossCurrency = currency !== toCurrency;
  const { suggestion, error, loading } = useCachedRate(
    currency,
    toCurrency,
    date,
  );
  const existingFee = entry
    ? data.entries.find((e) => e.transferId === entry.id)
    : undefined;
  const [feeAmount, setFeeAmount] = useState(
    existingFee ? minorText(existingFee.amount) : "",
  );
  const [chargedTo, setChargedTo] = useState(
    existingFee?.wallet === wallet && existingFee?.currency === currency
      ? "source"
      : "destination",
  );
  const [override, setOverride] = useState<{
    mode: "rate" | "received" | "saved";
    rate: string;
    received?: string;
    source: AppliedRate["source"];
    referenceDate?: string;
  } | null>(() =>
    entry?.received && crossCurrency
      ? {
          mode: "saved",
          rate:
            entry.exchangeRate?.value ??
            rateFromAmounts(minorText(entry.amount), minorText(entry.received)),
          received: minorText(entry.received),
          source: entry.exchangeRate?.source ?? "received",
          referenceDate: entry.exchangeRate?.referenceDate,
        }
      : null,
  );
  const unchangedSaved =
    override?.mode === "saved" && amount === minorText(entry!.amount);
  const rate =
    override?.mode === "received" ||
    (override?.mode === "saved" && !unchangedSaved)
      ? rateFromAmounts(amount, override.received ?? "")
      : (override?.rate ?? suggestion?.rate ?? "");
  const conversion = convertedAmount(amount, crossCurrency ? rate : "1");
  const received =
    override?.mode === "received" || override?.mode === "saved"
      ? (override?.received ?? "")
      : conversion.value;
  const source =
    override?.mode === "saved" && !unchangedSaved
      ? "received"
      : (override?.source ?? (suggestion ? "ecb" : "manual"));
  const referenceDate = override?.referenceDate ?? suggestion?.rateDate ?? "";
  const destination = chargedTo === "destination";
  const feeCurrency = destination ? toCurrency : currency;
  const totals = transferTotals(amount, received, feeAmount, destination);
  const fromName =
    data.wallets.find((w) => w.id === wallet)?.name ?? "Source wallet";
  const toName =
    data.wallets.find((w) => w.id === toWallet)?.name ?? "Destination wallet";
  return (
    <>
      {crossCurrency && (
        <>
          <div className="form-field">
            <Label htmlFor={`${id}-rate`}>
              Exchange rate (1 {currency} in {toCurrency})
            </Label>
            <Input
              id={`${id}-rate`}
              name="exchangeRate"
              type="number"
              inputMode="decimal"
              step="any"
              min="0.000000000001"
              max="999999999999"
              required
              value={rate}
              aria-describedby={`${id}-rate-help`}
              onChange={(e) =>
                setOverride({
                  mode: "rate",
                  rate: e.target.value,
                  source: "manual",
                })
              }
            />
            <small id={`${id}-rate-help`}>
              {override
                ? source === "ecb"
                  ? `Saved ECB reference · ${referenceDate}`
                  : "Your actual conversion rate."
                : suggestion
                  ? `ECB via Frankfurter · ${suggestion.rateDate}${suggestion.stale ? " · refresh overdue" : ""}`
                  : loading
                    ? "Loading the saved reference rate…"
                    : error}
              {suggestion &&
                " Reference rates are estimates; your bank’s rate may differ."}
            </small>
            {override && suggestion && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setOverride({
                    mode: "rate",
                    rate: suggestion.rate,
                    source: "ecb",
                    referenceDate: suggestion.rateDate,
                  })
                }
              >
                Use suggested rate
              </Button>
            )}
            <input type="hidden" name="rateSource" value={source} />
            <input type="hidden" name="referenceDate" value={referenceDate} />
          </div>
        </>
      )}
      <div className="form-field">
        <Label htmlFor={`${id}-received`}>
          Amount received before fee ({toCurrency})
        </Label>
        <Input
          id={`${id}-received`}
          name="received"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max="999999999999.99"
          required
          value={received}
          readOnly={!crossCurrency}
          aria-describedby={`${id}-received-help`}
          onChange={(e) =>
            setOverride({
              mode: "received",
              received: e.target.value,
              rate: "",
              source: "received",
            })
          }
        />
        <small id={`${id}-received-help`}>
          {crossCurrency
            ? "Enter the actual converted amount before a separately recorded service fee; the exchange rate adjusts automatically."
            : "Same-currency transfers use the amount sent before the service fee."}
        </small>
      </div>
      {conversion.error && override?.mode !== "received" && !unchangedSaved && (
        <Alert variant="destructive">{conversion.error}</Alert>
      )}
      <div className="form-row">
        <div className="form-field">
          <Label htmlFor={`${id}-fee`}>Service fee ({feeCurrency})</Label>
          <Input
            id={`${id}-fee`}
            name="feeAmount"
            type="number"
            inputMode="decimal"
            min="0"
            max="999999999999.99"
            step="0.01"
            value={feeAmount}
            placeholder="0.00"
            onChange={(e) => setFeeAmount(e.target.value)}
          />
        </div>
        <LedgerSelect
          label="Fee charged to"
          name="feeChargedTo"
          value={chargedTo}
          options={[
            { value: "source", label: `Source · ${fromName} (${currency})` },
            {
              value: "destination",
              label: `Destination · ${toName} (${toCurrency})`,
            },
          ]}
          onValueChange={(value) => {
            setChargedTo(value);
            if (currency !== toCurrency) setFeeAmount("");
          }}
        />
      </div>
      <div className="transfer-summary" role="status" aria-live="polite">
        {totals && amount && (
          <>
            <p>
              <strong>{fromName} pays</strong>
              <span>{format(totals.debit, currency)}</span>
            </p>
            <p>
              <strong>{toName} receives</strong>
              <span>{format(totals.credit, toCurrency)}</span>
            </p>
          </>
        )}
        <small>Any service fee is saved as a linked Admin fees expense.</small>
      </div>
    </>
  );
}
