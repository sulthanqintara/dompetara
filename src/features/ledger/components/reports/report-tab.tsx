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
  return (
    <>
      <Card className="panel report">
        <div className="panel-heading">
          <h3>Spending by category</h3>
          <span>{currency} · {periodLabel(period)}</span>
        </div>
        {groups.length ? (
          <ExpenseCategoryChart groups={groups} expense={expense} currency={currency} />
        ) : (
          <Empty className="empty">
            <ChartNoAxesCombined />
            <h3>No spending to report yet</h3>
          </Empty>
        )}
        <p className="wallet-footnote">
          Transfers and balance corrections are excluded from income and expenses.
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
        periodLabel="All history"
      />
    </>
  );
}
