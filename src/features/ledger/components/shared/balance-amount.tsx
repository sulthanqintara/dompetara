import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useLedgerContext } from "../../use-ledger-context";
import { splitCurrencyAmount } from "../../format";
import type { Currency } from "../../ledger";

export function BalanceAmount({ children, currency, approximate = false, currencyDisplay = "symbol" }: { children: ReactNode; currency: Currency; approximate?: boolean; currencyDisplay?: "symbol" | "code" }) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const { balancesVisible } = useLedgerContext();
  const { prefix, amount } = typeof children === "string"
    ? splitCurrencyAmount(children, currency, currencyDisplay, locale)
    : { prefix: `${currency} `, amount: children };
  return (
    <span className="balance-amount">
      <span className="balance-amount-indicator">{approximate ? "≈ " : ""}</span>
      <span className="balance-amount-currency">{prefix.replace(/\s+$/, " ")}</span>
      <span className="balance-amount-number">
        <span className="balance-amount-value" aria-hidden={!balancesVisible}
          style={{ visibility: balancesVisible ? "visible" : "hidden" }}>{amount}</span>
        {!balancesVisible && <span className="hidden-balance" role="img" aria-label={t("amountHidden")}>
          {Array.from({ length: 9 }, (_, index) => <span key={index} className="hidden-balance-dot" aria-hidden="true" />)}
        </span>}
      </span>
    </span>
  );
}
