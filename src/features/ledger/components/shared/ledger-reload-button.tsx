import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLedgerStore } from "../../use-ledger-store";

export function LedgerReloadButton() {
  const t = useTranslations("UI");
  const pending = useLedgerStore((state) => state.pending);
  const reloading = useLedgerStore((state) => state.reloading);
  const reload = useLedgerStore((state) => state.reload);
  return <Button type="button" variant="outline" disabled={pending} onClick={reload}>
    {reloading && <Spinner />}
    {reloading ? t("loadingLatestLedger") : t("reloadLatestLedger")}
  </Button>;
}
