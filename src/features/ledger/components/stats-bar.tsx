import { Card } from "@/components/ui/card";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet as WalletIcon,
} from "lucide-react";
import { format } from "../format";
import type { Currency } from "../ledger";

export function StatsBar({
  income,
  expense,
  total,
  currency,
}: {
  income: number;
  expense: number;
  total: number;
  currency: Currency;
}) {
  return (
    <div className="stats">
      <Card className="stat">
        <span>
          Period income <ArrowDownLeft size={19} />
        </span>
        <h2 className="positive">{format(income, currency)}</h2>
        <small>Money coming in</small>
      </Card>
      <Card className="stat">
        <span>
          Period expenses <ArrowUpRight size={19} />
        </span>
        <h2>{format(expense, currency)}</h2>
        <small>Money going out</small>
      </Card>
      <Card className="stat balance-stat">
        <span>
          Total balance <WalletIcon size={19} />
        </span>
        <h2>{format(total, currency)}</h2>
        <small>Current balance across all wallets · {currency}</small>
      </Card>
    </div>
  );
}
