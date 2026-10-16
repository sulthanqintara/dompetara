import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  const t = useTranslations("UI");
  return <div data-ledger-loading role="status" aria-label={t("loadingWorkspaceContent")} aria-busy="true">
    {[0, 1, 2, 3, 4].map((panel) => <Card className="settings-panel" key={panel} aria-hidden="true">
      <Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-11 w-full max-w-72" />
    </Card>)}
  </div>;
}
