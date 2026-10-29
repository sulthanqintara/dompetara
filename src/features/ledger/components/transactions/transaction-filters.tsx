import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Ledger } from "../../ledger";
import type { TransactionFilters as Filters } from "../../transaction-filters";
import { TransactionFilterFields } from "./transaction-filter-fields";
import { MobileTransactionFilters } from "./mobile-transaction-filters";
import { TransactionSubmit } from "./transaction-submit";
import { TransactionFilterForm } from "./transaction-filter-form";
import { applyTransactionFilters } from "../../apply-transaction-filters";

export function TransactionFilters({ data, filters, pending }: { data: Ledger; filters: Filters; pending: boolean }) {
  const t = useTranslations("UI");
  const id = useId();
  return (
    <>
      <MobileTransactionFilters data={data} filters={filters} pending={pending} />
      <TransactionFilterForm
        className="transaction-filters desktop-history-filters"
        aria-label={t("filterTransactionHistory")}
      >
        <div className="form-field transaction-search">
          <Label htmlFor={id}>{t("searchTransactions")}</Label>
          <Input
            id={id}
            name="search"
            type="search"
            maxLength={1000}
            defaultValue={filters.search}
            placeholder={t("titleNotesCategoryOrWallet")}
          />
        </div>
        <TransactionFilterFields data={data} filters={filters} />
        <div className="transaction-filter-actions">
          <Button type="button" variant="outline" onClick={() => applyTransactionFilters({})}>
            {t("clearFilters")}
          </Button>
          <TransactionSubmit pending={pending} />
        </div>
        <p className="hint transaction-search">
          {t(
            "filtersApplyWithinTheSelectedPeriodTransfersMatchEitherWalletAndEitherCurrencySummaryTotalsUseThePeriodAndSummaryCurrency",
          )}
        </p>
      </TransactionFilterForm>
    </>
  );
}
