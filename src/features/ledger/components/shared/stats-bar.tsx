import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { CurrentBalanceCard } from "./current-balance-card";
import { BalanceAmount } from "./balance-amount";
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
  const locale = useLocale();
  const t = useTranslations("UI");
  return (
    <div className="stats">
      <Card className="stat">
        <span>
          {t("periodIncome")} <ArrowDownLeft size={19} />
        </span>
        <h2 className="positive"><BalanceAmount currency={currency}>{format(income, currency, locale)}</BalanceAmount></h2>
      </Card>
      <Card className="stat">
        <span>
          {t("periodExpenses")} <ArrowUpRight size={19} />
        </span>
        <h2><BalanceAmount currency={currency}>{format(expense, currency, locale)}</BalanceAmount></h2>
      </Card>
      <CurrentBalanceCard data={data} currency={currency} />
    </div>
  );
}
