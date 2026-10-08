import { useTranslations } from "next-intl";
import Form from "next/form";
import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Ledger } from "../../ledger";
import type { TransactionFilters as Filters } from "../../transaction-filters";
import { TransactionFilterFields } from "./transaction-filter-fields";
import { MobileTransactionFilters } from "./mobile-transaction-filters";

export function TransactionFilters({ data, filters }: { data: Ledger; filters: Filters }) {
  const t = useTranslations("UI");
  const id = useId();
  return <>
    <MobileTransactionFilters data={data} filters={filters} />
    <Form action="/transactions" scroll={false} className="transaction-filters desktop-history-filters" aria-label={t("filterTransactionHistory")}>
    <div className="form-field transaction-search">
      <Label htmlFor={id}>{t("searchTransactions")}</Label>
      <Input id={id} name="search" type="search" maxLength={1000} defaultValue={filters.search} placeholder={t("titleNotesCategoryOrWallet")} />
    </div>
    <TransactionFilterFields data={data} filters={filters} />
    <div className="transaction-filter-actions">
      <Button variant="outline" nativeButton={false} render={<Link href="/transactions" scroll={false} />}>{t("clearFilters")}</Button>
      <Button type="submit">{t("applyFilters")}</Button>
    </div>
    <p className="hint transaction-search">{t("filtersApplyWithinTheSelectedPeriodTransfersMatchEitherWalletAndEitherCurrencySummaryTotalsUseThePeriodAndSummaryCurrency")}</p>
  </Form>
  </>;
}
