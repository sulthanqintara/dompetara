import { Card } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { CurrentBalanceCard } from "./current-balance-card";
import { format } from "../../format";
import type { Currency, Ledger } from "../../ledger";

export function StatsBar({
  income,
  expense,
  data,
  currency,
}: {
  income: number;
  expense: number;
  data: Ledger;
  currency: Currency;
}) {
  return (
    <div className="stats">
      <Card className="stat">
        <span>
          Period income <ArrowDownLeft size={19} />
        </span>
        <h2 className="positive">{format(income, currency)}</h2>
      </Card>
      <Card className="stat">
        <span>
          Period expenses <ArrowUpRight size={19} />
        </span>
        <h2>{format(expense, currency)}</h2>
      </Card>
      <CurrentBalanceCard data={data} currency={currency} />
    </div>
  );
}
