import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportSkeleton() {
  const t = useTranslations("UI");
  return <div data-ledger-loading role="status" aria-label={t("loadingWorkspaceContent")} aria-busy="true">
    {["spendingByCategory", "dailySpending", "monthlySpending"].map((label, index) => <Card key={label} className={`panel ${index ? "spending-history" : "report"}`} aria-hidden="true">
      <div className="panel-heading"><h3>{t(label)}</h3><Skeleton className="h-4 w-24" /></div>
      <div className="report-skeleton-body"><Skeleton className={index ? "h-65 w-full" : "size-65 max-w-full rounded-full mx-auto"} />
        <div>{[0, 1, 2].map((row) => <Skeleton key={row} className="h-6 w-full my-3" />)}</div>
      </div>
    </Card>)}
  </div>;
}
