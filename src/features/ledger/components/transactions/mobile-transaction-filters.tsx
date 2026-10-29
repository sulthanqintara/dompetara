import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { SheetContent } from "@/components/ui/sheet-content";
import { SheetTitle } from "@/components/ui/sheet-title";
import { SheetDescription } from "@/components/ui/sheet-description";
import { useSidebar } from "@/components/ui/use-sidebar";
import type { Ledger } from "../../ledger";
import { transactionFiltersSchema, type TransactionFilters as Filters } from "../../transaction-filters";
import { TransactionFilterFields } from "./transaction-filter-fields";
import { TransactionFilterForm } from "./transaction-filter-form";
import { TransactionSubmit } from "./transaction-submit";
import { applyTransactionFilters } from "../../apply-transaction-filters";
import { Spinner } from "@/components/ui/spinner";
import { transactionFilterChips } from "../../transaction-filter-chips";

export function MobileTransactionFilters({ data, filters, pending }: { data: Ledger; filters: Filters; pending: boolean }) {
  const t = useTranslations("UI");
  const { isPhone } = useSidebar();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(filters.search);
  const [draft, setDraft] = useState(filters);
  const active = (["wallet", "category", "type", "currency"] as const).filter((key) => filters[key] !== "all");
  const chips = transactionFilterChips(data, filters, t);
  return <div className="mobile-history-filters">
    <div className="mobile-history-toolbar">
      <TransactionFilterForm aria-label={t("searchTransactionHistory")} className="mobile-history-search">
        <Label htmlFor={id} className="sr-only">{t("searchTransactions")}</Label>
        <Input id={id} name="search" type="search" maxLength={1000} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchTransactionsEllipsis")} />
        {active.map((key) => <input key={key} type="hidden" name={key} value={filters[key]} />)}
        <Button type="submit" variant="ghost" size="icon" disabled={pending} aria-busy={pending} aria-label={t("searchTransactions")}>{pending ? <Spinner /> : <Search />}</Button>
      </TransactionFilterForm>
      <Button ref={trigger} variant="outline" aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        setDraft(filters);
        setOpen(true);
      }}><SlidersHorizontal /><span>{active.length ? t("filtersCount", { count: active.length }) : t("filters")}</span></Button>
    </div>
    {chips.length > 0 && <div className="mobile-active-filters" aria-label={t("appliedTransactionFilters")}>
      {chips.map(({ key, label }) => <Button key={key} type="button" variant="secondary" className="compact-pill removable-pill"
          onClick={() => applyTransactionFilters({ ...filters, [key]: undefined })} aria-label={t("removeFilter", { label })}>
          <span>{label}</span><X />
        </Button>)}
    </div>}
    <Sheet open={open && isPhone} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="mobile-filter-sheet" finalFocus={trigger}>
        <div className="mobile-filter-sheet-heading">
          <SheetTitle>{t("filterTransactionHistory")}</SheetTitle>
          <SheetDescription>{t("filterSummaryHint")}</SheetDescription>
        </div>
        <TransactionFilterForm aria-label={t("filterTransactionHistory")} className="mobile-filter-sheet-form" onApplied={() => setOpen(false)}>
          <input type="hidden" name="search" value={search} />
          <div className="mobile-filter-sheet-body">
            <TransactionFilterFields data={data} filters={draft} onChange={setDraft} />
            <p className="hint">{t("transferFilterHint")}</p>
          </div>
          <div className="mobile-filter-sheet-actions">
            <Button type="button" variant="outline" onClick={() => setDraft(transactionFiltersSchema.parse({}))}>{t("reset")}</Button>
            <TransactionSubmit pending={pending} />
          </div>
        </TransactionFilterForm>
      </SheetContent>
    </Sheet>
  </div>;
}
