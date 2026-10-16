import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/collapsible";
import { CollapsibleTrigger } from "@/components/ui/collapsible-trigger";
import { ChevronDown } from "lucide-react";

export function SummarySkeleton() {
  const t = useTranslations("UI");
  return <div data-ledger-loading role="status" aria-label={t("loadingWorkspaceContent")} aria-busy="true" className="stats summary-skeleton">
    {["periodIncome", "periodExpenses"].map((label) => <Card key={label} className="stat" aria-hidden="true">
      <span>{t(label)}</span><h2><Skeleton className="w-full max-w-36" /></h2>
    </Card>)}
    <Card className="stat balance-stat" aria-hidden="true"><span>{t("currentBalance")}</span>
      <h2><Skeleton className="w-48 max-w-full" /></h2>
      <Collapsible><CollapsibleTrigger disabled render={<Button variant="ghost" disabled />} className="balance-toggle"><span>{t("walletBalances")}</span><ChevronDown /></CollapsibleTrigger></Collapsible>
    </Card>
  </div>;
}
