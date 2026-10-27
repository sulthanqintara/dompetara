import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import type { RateSuggestion } from "@/features/exchange-rates/exchange-rates";

export function TransferRateHelp({ id, overridden, source, referenceDate, suggestion, loading, error }: {
  id: string; overridden: boolean; source: string; referenceDate: string;
  suggestion: RateSuggestion | null; loading: boolean; error: string;
}) {
  const t = useTranslations("UI");
  const errorMessage = useErrorMessage();
  let label: string;
  if (overridden) label = source === "ecb" ? t("savedReference", { date: referenceDate }) : t("yourActualConversionRate");
  else if (suggestion) label = t(suggestion.stale ? "staleReferenceRate" : "referenceRate", { date: suggestion.rateDate });
  else label = loading ? t("loadingTheSavedReferenceRate") : errorMessage(error);
  return <small id={id}>{label}{suggestion && t("referenceRatesAreEstimatesYourBankSRateMayDiffer")}</small>;
}
