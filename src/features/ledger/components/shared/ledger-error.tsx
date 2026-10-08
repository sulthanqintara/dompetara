import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLedgerContext } from "../../use-ledger-context";

export function LedgerError() {
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
  const { error, conflict, notice, pending, reloading, reload } = useLedgerContext();
  if (!error && !conflict && !notice) return null;
  return (
    <Alert variant={error || conflict ? "destructive" : "default"} className={error || conflict ? "error" : "mb-3"} role={error || conflict ? "alert" : "status"}>
      <p>{errorMessage(error) || (conflict ? t("yourLedgerChangedElsewhereReloadTheLatestLedgerBeforeSavingAgain") : errorMessage(notice))}</p>
      {(error || conflict) && (
        <Button type="button" variant="outline" disabled={pending} onClick={reload}>
          {reloading && <Spinner />}
          {reloading ? t("loadingLatestLedger") : t("reloadLatestLedger")}
        </Button>
      )}
    </Alert>
  );
}
