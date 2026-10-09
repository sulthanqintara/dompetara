"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { categoryBreakdown } from "../../derive";
import { format, formatShare } from "../../format";
import type { Currency } from "../../ledger";

export function ExpenseCategoryChart({
  groups,
  expense,
  currency,
}: {
  groups: [string, number][];
  expense: number;
  currency: Currency;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const captionId = useId();
  const data = categoryBreakdown(groups, expense).map((item, index) => ({
    ...item,
    fill: `var(--color-category-${index})`,
    color: `var(--chart-${(index % 5) + 1})`,
  }));
  // Generated keys keep category text out of the chart's CSS selectors.
  const config = Object.fromEntries(
    data.map((item, index) => [
      `category-${index}`,
      { label: item.category, color: item.color },
    ]),
  ) satisfies ChartConfig;

  return (
    <div className="expense-breakdown">
      <figure className="expense-chart-figure">
        <ChartContainer
          config={config}
          className="expense-pie-chart"
          initialDimension={{ width: 200, height: 280 }}
        >
          <PieChart
            accessibilityLayer={false}
            role="img"
            aria-label={t("expenseCategoryPieChart")}
            aria-describedby={captionId}
          >
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              outerRadius="85%"
              stroke="var(--card)"
              strokeWidth={2}
              rootTabIndex={-1}
              isAnimationActive={false}
            />
          </PieChart>
        </ChartContainer>
        <figcaption id={captionId}>
          <strong>{t("totalExpenses", { amount: format(expense, currency, locale) })}</strong>
          <span>{t("seeTheCategoryBreakdownForEveryAmountAndPercentage")}</span>
        </figcaption>
      </figure>
      <dl className="expense-category-list" aria-label={t("expenseCategories")}>
        {data.map(({ category, amount, share, color }) => (
          <div className="report-row" key={category}>
            <dt>
              <span
                className="category-swatch"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span>{category}</span>
            </dt>
            <dd>
              <strong>{format(amount, currency, locale)}</strong>
              <span>{t("expenseShare", { share: formatShare(share, locale) })}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
