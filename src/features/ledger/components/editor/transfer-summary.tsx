import { useLocale, useTranslations } from "next-intl";
import type { Currency } from "../../ledger";
import { format } from "../../format";
import { transferTotals } from "../../transfer";

export function TransferSummary({ amount, received, fee, chargedTo, fromName, toName, currency, toCurrency }: {
  amount: string; received: string; fee: string; chargedTo: string;
  fromName: string; toName: string; currency: Currency; toCurrency: Currency;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const totals = transferTotals(amount, received, fee, chargedTo === "destination");
  return <div className="transfer-summary" role="status" aria-live="polite">
    {totals && amount && <>
      <p><strong>{t("walletPays", { name: fromName })}</strong><span>{format(totals.debit, currency, locale)}</span></p>
      <p><strong>{t("walletReceives", { name: toName })}</strong><span>{format(totals.credit, toCurrency, locale)}</span></p>
    </>}
    {Number(fee) > 0 && <small>{t("feeCategoryAdminFees")}</small>}
  </div>;
}
