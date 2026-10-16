import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/features/i18n/use-error-message";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLedgerContext } from "../../use-ledger-context";

export function LedgerQueryError({ error }: { error: string }) {
  const t = useTranslations("UI");
  const errorMessage = useErrorMessage();
  const { reload, pending } = useLedgerContext();
  return <Alert variant="destructive" role="alert"><p>{errorMessage(error)}</p>
    <Button variant="outline" disabled={pending} onClick={reload}>{t("reloadLatestLedger")}</Button>
  </Alert>;
}
