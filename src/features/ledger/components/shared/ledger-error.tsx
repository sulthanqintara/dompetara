import { useErrorMessage } from "@/features/i18n/use-error-message";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLedgerStore } from "../../use-ledger-store";

export function LedgerError() {
  const errorMessage = useErrorMessage();
  const t = useTranslations("UI");
  const error = useLedgerStore((state) => state.error);
  const conflict = useLedgerStore((state) => state.conflict);
  const notice = useLedgerStore((state) => state.notice);
  const pending = useLedgerStore((state) => state.pending);
  const reloading = useLedgerStore((state) => state.reloading);
  const reload = useLedgerStore((state) => state.reload);
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
