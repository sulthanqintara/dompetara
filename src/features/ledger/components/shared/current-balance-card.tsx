import { useLocale, useTranslations } from "next-intl";
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
  const locale = useLocale();
  const t = useTranslations("UI");
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
      <span>{t("currentBalance")}<BalanceVisibilityToggle /></span>
      <h2><BalanceAmount currency={currency}>{loading ? <Skeleton className="h-8 w-40" /> : result.total === null ? "—" : format(result.total, currency, locale)}</BalanceAmount></h2>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger render={<Button variant="ghost" />} className="balance-toggle" aria-label={expanded ? t("hideWalletBalances") : t("showWalletBalances")}>
        <span>{t("walletBalances")}</span>
        <ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : undefined} />
      </CollapsibleTrigger>
      <CollapsibleContent className="balance-panel" keepMounted>
      <dl className="balance-breakdown">
        {result.rows.map((row) => (
          <div key={row.currency}>
            <dt>{t("currencyWallets", { currency: row.currency })}</dt>
            <dd>
              <span><BalanceAmount currency={row.currency} currencyDisplay="code">{format(row.amount, row.currency, locale)}</BalanceAmount></span>
              {row.currency !== currency && <span><BalanceAmount currency={currency} currencyDisplay="code" approximate>{states[row.currency].loading && row.amount !== 0 ? t("converting") : row.converted === null ? t("conversionUnavailable") : format(row.converted, currency, locale)}</BalanceAmount></span>}
            </dd>
          </div>
        ))}
      </dl>
      </CollapsibleContent>
      </Collapsible>
      {result.dates.length > 0 && <small>{t("balanceEstimate", { dates: result.dates.join(", ") })}{result.stale ? t("cachedRatesMayBeOutdated") : ""}</small>}
      {!loading && result.total === null && <Alert>
        <p>{t("completeConversionUnavailableExpandWalletBalancesToSeeNativeAmounts")}</p>
        <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>{t("retryConversion")}</Button>
      </Alert>}
    </Card>
  );
}
