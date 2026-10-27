import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import type { Currency, Entry, Ledger } from "../../ledger";
import { initialTransferFields, transferConversion, type TransferOverride } from "../../transfer-editor";
import { TransferReceivedField } from "./transfer-received-field";
import { TransferRateFields } from "./transfer-rate-fields";
import { TransferFeeFields } from "./transfer-fee-fields";
import { TransferSummary } from "./transfer-summary";

export function TransferFields({ entry, data, currency, toCurrency, wallet, toWallet, amount, date }: {
  entry?: Entry; data: Ledger; currency: Currency; toCurrency: Currency;
  wallet: string; toWallet: string; amount: string; date: string;
}) {
  const t = useTranslations("UI");
  const id = useId();
  const crossCurrency = currency !== toCurrency;
  const { suggestion, error, loading } = useCachedRate(currency, toCurrency, date);
  const [fields, setFields] = useState(() => initialTransferFields(data, entry, currency, toCurrency, wallet));
  const { feeAmount, chargedTo, override } = fields;
  const setOverride = (override: TransferOverride) => setFields((current) => ({ ...current, override }));
  const setFeeAmount = (feeAmount: string) => setFields((current) => ({ ...current, feeAmount }));
  const setChargedTo = (chargedTo: string) => setFields((current) => ({ ...current, chargedTo }));
  const conversion = transferConversion(amount, crossCurrency, override, suggestion);
  const fromName = data.wallets.find((saved) => saved.id === wallet)?.name ?? t("sourceWallet");
  const toName = data.wallets.find((saved) => saved.id === toWallet)?.name ?? t("destinationWallet");
  return <>
    {crossCurrency && <TransferRateFields id={id} currency={currency} toCurrency={toCurrency} conversion={conversion}
      override={override} suggestion={suggestion} loading={loading} error={error} onOverride={setOverride} />}
    <TransferReceivedField id={id} currency={toCurrency} crossCurrency={crossCurrency} conversion={conversion}
      onReceived={(received) => setOverride({ mode: "received", received, source: "received" })} />
    <TransferFeeFields id={id} currency={currency} toCurrency={toCurrency} fromName={fromName} toName={toName}
      amount={feeAmount} chargedTo={chargedTo} onAmount={setFeeAmount} onChargedTo={setChargedTo} />
    <TransferSummary amount={amount} received={conversion.received} fee={feeAmount} chargedTo={chargedTo}
      fromName={fromName} toName={toName} currency={currency} toCurrency={toCurrency} />
  </>;
}
