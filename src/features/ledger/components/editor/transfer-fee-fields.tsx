import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import type { Currency } from "../../ledger";
import { CurrencyInput } from "./currency-input";
import { LedgerSelect } from "../shared/ledger-select";

export function TransferFeeFields({ id, currency, toCurrency, fromName, toName, amount, chargedTo, onAmount, onChargedTo }: {
  id: string; currency: Currency; toCurrency: Currency; fromName: string; toName: string;
  amount: string; chargedTo: string; onAmount: (amount: string) => void; onChargedTo: (value: string) => void;
}) {
  const t = useTranslations("UI");
  const feeCurrency = chargedTo === "destination" ? toCurrency : currency;
  return <div className="form-row">
    <div className="form-field">
      <Label htmlFor={`${id}-fee`}>{t("serviceFeeLabel", { currency: feeCurrency })}</Label>
      <CurrencyInput id={`${id}-fee`} name="feeAmount" currency={feeCurrency} allowZero value={amount} onValueChange={onAmount} />
    </div>
    <LedgerSelect label={t("feeChargedTo")} name="feeChargedTo" value={chargedTo}
      options={[{ value: "source", label: t("sourceOption", { name: fromName, currency }) },
        { value: "destination", label: t("destinationOption", { name: toName, currency: toCurrency }) }]}
      onValueChange={(value) => { onChargedTo(value); if (currency !== toCurrency) onAmount(""); }} />
  </div>;
}
