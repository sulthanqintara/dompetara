import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Currency } from "../../ledger";
import type { RateSuggestion } from "@/features/exchange-rates/exchange-rates";
import type { TransferOverride, transferConversion } from "../../transfer-editor";
import { TransferRateHelp } from "./transfer-rate-help";

export function TransferRateFields({ id, currency, toCurrency, conversion, override, suggestion, loading, error, onOverride }: {
  id: string; currency: Currency; toCurrency: Currency;
  conversion: ReturnType<typeof transferConversion>; override: TransferOverride | null;
  suggestion: RateSuggestion | null; loading: boolean; error: string;
  onOverride: (override: TransferOverride) => void;
}) {
  const t = useTranslations("UI");
  return <div className="form-field">
    <Label htmlFor={`${id}-rate`}>{t("exchangeRateLabel", { currency, toCurrency })}</Label>
    <Input id={`${id}-rate`} name="exchangeRate" type="number" inputMode="decimal" step="any"
      min="0.000000000001" max="999999999999" required value={conversion.rate} aria-describedby={`${id}-rate-help`}
      onChange={(event) => onOverride({ mode: "rate", rate: event.target.value, source: "manual" })} />
    <TransferRateHelp id={`${id}-rate-help`} overridden={override !== null} source={conversion.source}
      referenceDate={conversion.referenceDate} suggestion={suggestion} loading={loading} error={error} />
    {override && suggestion && <Button type="button" variant="outline"
      onClick={() => onOverride({ mode: "rate", rate: suggestion.rate, source: "ecb", referenceDate: suggestion.rateDate })}>
      {t("useSuggestedRate")}
    </Button>}
    <input type="hidden" name="rateSource" value={conversion.source} />
    <input type="hidden" name="referenceDate" value={conversion.referenceDate} />
  </div>;
}
