import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ChartNoAxesCombined } from "lucide-react";
import type { Currency } from "../ledger";
import { ExpenseCategoryChart } from "./expense-category-chart";

export function ReportTab({
  groups,
  expense,
  currency,
  month,
}: {
  groups: [string, number][];
  expense: number;
  currency: Currency;
  month: string;
}) {
  return (
    <Card className="panel report">
      <div className="panel-heading">
        <h3>Spending by category</h3>
        <span>
          {currency} · {month}
        </span>
      </div>
      {groups.length ? (
        <ExpenseCategoryChart
          groups={groups}
          expense={expense}
          currency={currency}
        />
      ) : (
        <Empty className="empty">
          <ChartNoAxesCombined />
          <h3>No spending to report yet</h3>
          <p>Your expenses will appear here, grouped by category.</p>
        </Empty>
      )}
      <p className="wallet-footnote">
        Transfers and balance corrections are excluded from income and expenses.
      </p>
    </Card>
  );
}
