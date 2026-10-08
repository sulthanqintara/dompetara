import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible } from "@/components/ui/collapsible";
import { CollapsibleTrigger } from "@/components/ui/collapsible-trigger";
import { CollapsibleContent } from "@/components/ui/collapsible-content";
import { ChevronDown } from "lucide-react";
import { BalanceAmount } from "./balance-amount";
import { BalanceVisibilityToggle } from "./balance-visibility-toggle";
import { useCachedRate } from "@/features/exchange-rates/hooks";
import { balanceBreakdown } from "../../balances";
import { format, localDate } from "../../format";
import type { Currency, Ledger } from "../../ledger";

export function CurrentBalanceCard({ data, currency }: { data: Ledger; currency: Currency }) {
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const date = localDate().slice(0, 10);
  const idr = useCachedRate("IDR", currency, date, attempt);
  const usd = useCachedRate("USD", currency, date, attempt);
  const cad = useCachedRate("CAD", currency, date, attempt);
  const states = { IDR: idr, USD: usd, CAD: cad };
  const result = balanceBreakdown(data, currency, { IDR: idr.suggestion, USD: usd.suggestion, CAD: cad.suggestion });
  const loading = result.rows.some((row) => row.currency !== currency && row.amount !== 0 && states[row.currency].loading);
  return (
    <Card className="stat balance-stat" aria-busy={loading}>
      <span>Current balance <BalanceVisibilityToggle /></span>
      <h2><BalanceAmount currency={currency}>{loading ? <Skeleton className="h-8 w-40" /> : result.total === null ? "—" : format(result.total, currency)}</BalanceAmount></h2>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger render={<Button variant="ghost" />} className="balance-toggle" aria-label={expanded ? "Hide wallet balances" : "Show wallet balances"}>
        <span>Wallet balances</span>
        <ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : undefined} />
      </CollapsibleTrigger>
      <CollapsibleContent className="balance-panel" keepMounted>
      <dl className="balance-breakdown">
        {result.rows.map((row) => (
          <div key={row.currency}>
            <dt>{row.currency} wallets</dt>
            <dd>
              <span><BalanceAmount currency={row.currency} currencyDisplay="code">{format(row.amount, row.currency)}</BalanceAmount></span>
              {row.currency !== currency && <span><BalanceAmount currency={currency} currencyDisplay="code" approximate>{states[row.currency].loading && row.amount !== 0 ? "Converting…" : row.converted === null ? "Conversion unavailable" : format(row.converted, currency)}</BalanceAmount></span>}
            </dd>
          </div>
        ))}
      </dl>
      </CollapsibleContent>
      </Collapsible>
      {result.dates.length > 0 && <small>Estimate · ECB reference rates · {result.dates.join(", ")}{result.stale ? " · cached rates may be outdated" : ""}</small>}
      {!loading && result.total === null && <Alert>
        <p>Complete conversion unavailable. Expand wallet balances to see native amounts.</p>
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Retry conversion</Button>
      </Alert>}
    </Card>
  );
}
