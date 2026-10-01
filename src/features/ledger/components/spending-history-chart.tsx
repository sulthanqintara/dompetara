import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { format } from "../format";
import type { Currency } from "../ledger";

export function SpendingHistoryChart({ points, currency, interval, periodLabel }: {
  points: { date: string; amount: number }[];
  currency: Currency;
  interval: "daily" | "monthly";
  periodLabel: string;
}) {
  const captionId = useId();
  const label = interval === "daily" ? "Daily spending" : "Monthly spending";
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  return (
    <Card className="panel spending-history">
      <div className="panel-heading">
        <h3>{label}</h3>
        <span>{currency} · {periodLabel}</span>
      </div>
      {points.length ? (
        <div className="spending-history-body">
          <figure>
            <ChartContainer
              className="spending-history-chart"
              config={{ amount: { label: "Expenses", color: "var(--chart-1)" } }}
              initialDimension={{ width: 240, height: 260 }}
            >
              <BarChart data={points} accessibilityLayer={false} role="img"
                aria-label={`${label} chart`} aria-describedby={captionId}
                margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24}
                  tickFormatter={(date: string) => interval === "daily" ? date.slice(5) : date} />
                <YAxis width={56} tickLine={false} axisLine={false}
                  tickFormatter={(amount: number) => compact.format(amount / 100)} />
                <Bar dataKey="amount" fill="var(--color-amount)" maxBarSize={48} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
            <figcaption id={captionId}>
              Expenses in {currency}. Only {interval === "daily" ? "days" : "months"} with spending are shown; others total zero.
              Transfers and balance corrections are excluded; service fees count as expenses.
            </figcaption>
          </figure>
          <dl className="spending-history-values" aria-label={`${label} amounts`}>
            {points.map(({ date, amount }) => (
              <div className="report-row" key={date}>
                <dt>{date}</dt>
                <dd><strong>{format(amount, currency)}</strong></dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <Empty className="empty">
          <h3>{interval === "daily" ? "No daily spending in this period" : "No monthly spending recorded"}</h3>
          <p>Expenses in {currency} will appear here.</p>
        </Empty>
      )}
    </Card>
  );
}
