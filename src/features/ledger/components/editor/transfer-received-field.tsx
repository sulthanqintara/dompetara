import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { Currency } from "../../ledger";
import type { transferConversion } from "../../transfer-editor";
import { CurrencyInput } from "./currency-input";

export function TransferReceivedField({ id, currency, crossCurrency, conversion, onReceived }: {
  id: string; currency: Currency; crossCurrency: boolean;
  conversion: ReturnType<typeof transferConversion>; onReceived: (received: string) => void;
}) {
  const t = useTranslations("UI");
  const errorMessage = useErrorMessage();
  return <>
    <div className="form-field">
      <Label htmlFor={`${id}-received`}>{t("receivedBeforeFee", { currency })}</Label>
      <CurrencyInput currency={currency} id={`${id}-received`} name="received" required value={conversion.received}
        readOnly={!crossCurrency} aria-describedby={crossCurrency ? `${id}-received-help` : undefined} onValueChange={onReceived} />
      {crossCurrency && <small id={`${id}-received-help`}>{t("changingThisAmountUpdatesTheExchangeRate")}</small>}
    </div>
    {conversion.error && <Alert variant="destructive">{errorMessage(conversion.error)}</Alert>}
  </>;
}
