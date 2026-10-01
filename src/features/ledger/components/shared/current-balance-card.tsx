import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import { balanceBreakdown } from "../../balances";
import { format, localDate } from "../../format";
import type { Currency, Ledger } from "../../ledger";

export function CurrentBalanceCard({ data, currency }: { data: Ledger; currency: Currency }) {
  const [attempt, setAttempt] = useState(0);
  const date = localDate().slice(0, 10);
  const idr = useCachedRate("IDR", currency, date, attempt);
  const usd = useCachedRate("USD", currency, date, attempt);
  const cad = useCachedRate("CAD", currency, date, attempt);
  const states = { IDR: idr, USD: usd, CAD: cad };
  const result = balanceBreakdown(data, currency, { IDR: idr.suggestion, USD: usd.suggestion, CAD: cad.suggestion });
  const loading = result.rows.some((row) => row.currency !== currency && row.amount !== 0 && states[row.currency].loading);
  return (
    <Card className="stat balance-stat" aria-busy={loading}>
      <span>Current balance <Wallet size={19} /></span>
      <h2>{loading ? <Skeleton className="h-8 w-40" /> : result.total === null ? "—" : format(result.total, currency)}</h2>
      <small>All wallets · {currency} equivalent · all recorded transactions</small>
      <dl className="balance-breakdown">
        {result.rows.map((row) => (
          <div key={row.currency}>
            <dt>{row.currency} wallets</dt>
            <dd>
              <span>{format(row.amount, row.currency)}</span>
              {row.currency !== currency && <span>{states[row.currency].loading && row.amount !== 0 ? "Converting…" : row.converted === null ? "Conversion unavailable" : `≈ ${format(row.converted, currency)}`}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {result.dates.length > 0 && <small>Estimate · ECB reference rates · {result.dates.join(", ")}{result.stale ? " · cached rates may be outdated" : ""}</small>}
      {!loading && result.total === null && <Alert>
        <p>Complete conversion unavailable. Native balances are shown above.</p>
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry conversion</Button>
      </Alert>}
    </Card>
  );
}
