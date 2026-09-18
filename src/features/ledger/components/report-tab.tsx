import { ChartNoAxesCombined } from "lucide-react";
import { format } from "../format";
import type { Currency } from "../ledger";

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
    <section className="panel report">
      <div className="panel-heading">
        <h3>Spending by category</h3>
        <span>
          {currency} · {month}
        </span>
      </div>
      {groups.length ? (
        groups.map(([category, amount]) => (
          <div className="report-row" key={category}>
            <div>
              <strong>{category}</strong>
              <span>
                {format(amount, currency)}{" "}
                <small>
                  {" "}
                  · {Math.round((amount / expense) * 100)}%
                </small>
              </span>
            </div>
            <meter
              min={0}
              max={expense}
              value={amount}
              aria-label={`${category} spending`}
            />
          </div>
        ))
      ) : (
        <div className="empty">
          <ChartNoAxesCombined />
          <h3>No spending to report yet</h3>
          <p>Your expenses will appear here, grouped by category.</p>
        </div>
      )}
      <p className="wallet-footnote">
        Transfers and balance corrections are excluded from income and
        expenses.
      </p>
    </section>
  );
}
