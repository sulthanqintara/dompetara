import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { LedgerReloadButton } from "./ledger-reload-button";
import { useLedgerStore } from "../../use-ledger-store";

export function LedgerError() {
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
  const error = useLedgerStore((state) => state.error);
  const conflict = useLedgerStore((state) => state.conflict);
  const notice = useLedgerStore((state) => state.notice);
  const hasError = Boolean(error || conflict);
  if (!hasError && !notice) return null;
  const message = errorMessage(error) || (conflict
    ? t("yourLedgerChangedElsewhereReloadTheLatestLedgerBeforeSavingAgain") : errorMessage(notice));
  return (
    <Alert variant={hasError ? "destructive" : "default"} className={hasError ? "error" : "mb-3"} role={hasError ? "alert" : "status"}>
      <p>{message}</p>
      {hasError && <LedgerReloadButton />}
    </Alert>
  );
}
