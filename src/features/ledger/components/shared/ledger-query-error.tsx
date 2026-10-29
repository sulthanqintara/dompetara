import { useErrorMessage } from "@/features/i18n/use-error-message";
import { Alert } from "@/components/ui/alert";
import { LedgerReloadButton } from "./ledger-reload-button";

export function LedgerQueryError({ error }: { error: string }) {
  const errorMessage = useErrorMessage();
  return <Alert variant="destructive" role="alert"><p>{errorMessage(error)}</p>
    <LedgerReloadButton />
  </Alert>;
}
