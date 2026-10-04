import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLedgerContext } from "../../use-ledger-context";

export function LedgerError() {
  const { error, conflict, notice, pending, reloading, reload } = useLedgerContext();
  if (!error && !conflict && !notice) return null;
  return (
    <Alert variant={error || conflict ? "destructive" : "default"} className={error || conflict ? "error" : "mb-3"} role={error || conflict ? "alert" : "status"}>
      <p>{error || (conflict ? "Your ledger changed elsewhere. Reload the latest ledger before saving again." : notice)}</p>
      {(error || conflict) && (
        <Button type="button" variant="outline" disabled={pending} onClick={reload}>
          {reloading && <Spinner />}
          {reloading ? "Loading latest ledger…" : "Reload latest ledger"}
        </Button>
      )}
    </Alert>
  );
}
