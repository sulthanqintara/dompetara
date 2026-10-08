import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ChartNoAxesCombined } from "lucide-react";
import { periodLabel, type Period } from "../../derive";
import type { Currency } from "../../ledger";
import { ExpenseCategoryChart } from "./expense-category-chart";
import { SpendingHistoryChart } from "./spending-history-chart";

export function ReportTab({
  groups,
  expense,
  currency,
  period,
  daily,
  monthly,
}: {
  groups: [string, number][];
  expense: number;
  currency: Currency;
  period: Period;
  daily: { date: string; amount: number }[];
  monthly: { date: string; amount: number }[];
}) {
  const t = useTranslations("UI");
  return (
    <>
      <Card className="panel report">
        <div className="panel-heading">
          <h3>{t("spendingByCategory")}</h3>
          <span>{currency} · {periodLabel(period)}</span>
        </div>
        {groups.length ? (
          <ExpenseCategoryChart groups={groups} expense={expense} currency={currency} />
        ) : (
          <Empty className="empty">
            <ChartNoAxesCombined />
            <h3>{t("noSpendingToReportYet")}</h3>
          </Empty>
        )}
        <p className="wallet-footnote">
          {t("transfersAndBalanceCorrectionsAreExcludedFromIncomeAndExpenses")}
        </p>
      </Card>
      <SpendingHistoryChart
        points={daily}
        currency={currency}
        interval="daily"
        periodLabel={periodLabel(period)}
      />
      <SpendingHistoryChart
        points={monthly}
        currency={currency}
        interval="monthly"
        periodLabel={t("allHistory")}
      />
    </>
  );
}
