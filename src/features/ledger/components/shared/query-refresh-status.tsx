import { useTranslations } from "next-intl";

export function QueryRefreshStatus({ refreshing }: { refreshing: boolean }) {
  const t = useTranslations("UI");
  return <span className="ledger-query-status" role="status" aria-live="polite">{refreshing ? t("updatingLedgerData") : ""}</span>;
}
