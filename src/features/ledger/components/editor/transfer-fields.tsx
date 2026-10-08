import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import type { AppliedRate } from "@/features/exchange-rates/exchange-rates";
import type { Currency, Entry, Ledger } from "../../ledger";
import { format } from "../../format";
import {
  convertedAmount,
  minorText,
  rateFromAmounts,
  transferTotals,
} from "../../transfer";
import { CurrencyInput } from "./currency-input";
import { LedgerSelect } from "../shared/ledger-select";

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
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
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
    data.wallets.find((w) => w.id === wallet)?.name ?? t("sourceWallet");
  const toName =
    data.wallets.find((w) => w.id === toWallet)?.name ?? t("destinationWallet");
  return (
    <>
      {crossCurrency && (
        <>
          <div className="form-field">
            <Label htmlFor={`${id}-rate`}>
              {t("exchangeRateLabel", { currency, toCurrency })}
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
                  ? t("savedReference", { date: referenceDate })
                  : t("yourActualConversionRate")
                : suggestion
                  ? t("referenceRate", { date: suggestion.rateDate }) + (suggestion.stale ? t("refreshOverdue") : "")
                  : loading
                    ? t("loadingTheSavedReferenceRate")
                    : errorMessage(error)}
              {suggestion &&
                t("referenceRatesAreEstimatesYourBankSRateMayDiffer")}
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
                {t("useSuggestedRate")}
              </Button>
            )}
            <input type="hidden" name="rateSource" value={source} />
            <input type="hidden" name="referenceDate" value={referenceDate} />
          </div>
        </>
      )}
      <div className="form-field">
        <Label htmlFor={`${id}-received`}>
          {t("receivedBeforeFee", { currency: toCurrency })}
        </Label>
        <CurrencyInput
          currency={toCurrency}
          id={`${id}-received`}
          name="received"
          required
          value={received}
          readOnly={!crossCurrency}
          aria-describedby={crossCurrency ? `${id}-received-help` : undefined}
          onValueChange={(value) =>
            setOverride({
              mode: "received",
              received: value,
              rate: "",
              source: "received",
            })
          }
        />
        {crossCurrency && (
          <small id={`${id}-received-help`}>{t("changingThisAmountUpdatesTheExchangeRate")}</small>
        )}
      </div>
      {conversion.error && override?.mode !== "received" && !unchangedSaved && (
        <Alert variant="destructive">{errorMessage(conversion.error)}</Alert>
      )}
      <div className="form-row">
        <div className="form-field">
          <Label htmlFor={`${id}-fee`}>{t("serviceFeeLabel", { currency: feeCurrency })}</Label>
          <CurrencyInput
            id={`${id}-fee`}
            name="feeAmount"
            currency={feeCurrency}
            allowZero
            value={feeAmount}
            onValueChange={setFeeAmount}
          />
        </div>
        <LedgerSelect
          label={t("feeChargedTo")}
          name="feeChargedTo"
          value={chargedTo}
          options={[
            { value: "source", label: t("sourceOption", { name: fromName, currency }) },
            {
              value: "destination",
              label: t("destinationOption", { name: toName, currency: toCurrency }),
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
              <strong>{t("walletPays", { name: fromName })}</strong>
              <span>{format(totals.debit, currency, locale)}</span>
            </p>
            <p>
              <strong>{t("walletReceives", { name: toName })}</strong>
              <span>{format(totals.credit, toCurrency, locale)}</span>
            </p>
          </>
        )}
        {Number(feeAmount) > 0 && <small>{t("feeCategoryAdminFees")}</small>}
      </div>
    </>
  );
}
