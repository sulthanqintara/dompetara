import { useTranslations } from "next-intl";
import { categoryLabel } from "@/features/i18n/format";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
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

export function MobileTransactionFilters({ data, filters }: { data: Ledger; filters: Filters }) {
  const t = useTranslations("UI");
  const { isPhone } = useSidebar();
  const id = useId();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(filters.search);
  const [draft, setDraft] = useState(filters);
  const active = (["wallet", "category", "type", "currency"] as const).filter((key) => filters[key] !== "all");
  const chips = [
    ...(filters.search ? [{ key: "search" as const, label: t("searchFilter", { value: filters.search }) }] : []),
    ...active.map((key) => ({ key, label: key === "wallet" ? t("walletFilter", { value: data.wallets.find((wallet) => wallet.id === filters.wallet)?.name ?? filters.wallet })
      : key === "category" ? t("categoryFilter", { value: categoryLabel(data, filters.category, t) }) : key === "currency" ? t("currencyFilter", { value: filters.currency })
      : t("typeFilter", { value: t({ income: "income", expense: "expense", transfer: "transfer", correction: "openingBalancesCorrections", all: "allTypes" }[filters.type]) }) })),
  ];
  return <div className="mobile-history-filters">
    <div className="mobile-history-toolbar">
      <Form action="/transactions" scroll={false} aria-label={t("searchTransactionHistory")} className="mobile-history-search">
        <Label htmlFor={id} className="sr-only">{t("searchTransactions")}</Label>
        <Input id={id} name="search" type="search" maxLength={1000} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchTransactionsEllipsis")} />
        {active.map((key) => <input key={key} type="hidden" name={key} value={filters[key]} />)}
        <Button type="submit" variant="ghost" size="icon" aria-label={t("searchTransactions")}><Search /></Button>
      </Form>
      <Button ref={trigger} variant="outline" aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        setDraft(filters);
        setOpen(true);
      }}><SlidersHorizontal /><span>{active.length ? t("filtersCount", { count: active.length }) : t("filters")}</span></Button>
    </div>
    {chips.length > 0 && <div className="mobile-active-filters" aria-label={t("appliedTransactionFilters")}>
      {chips.map(({ key, label }) => {
        const params = new URLSearchParams();
        for (const [name, value] of Object.entries(filters)) {
          if (name !== key && value && (name === "search" || value !== "all")) params.set(name, value);
        }
        return <Button key={key} variant="secondary" className="compact-pill removable-pill" nativeButton={false}
          render={<Link href={`/transactions${params.size ? `?${params}` : ""}`} scroll={false} />} aria-label={t("removeFilter", { label })}>
          <span>{label}</span><X />
        </Button>;
      })}
    </div>}
    <Sheet open={open && isPhone} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="mobile-filter-sheet" finalFocus={trigger}>
        <div className="mobile-filter-sheet-heading">
          <SheetTitle>{t("filterTransactionHistory")}</SheetTitle>
          <SheetDescription>{t("filterSummaryHint")}</SheetDescription>
        </div>
        <Form action="/transactions" scroll={false} aria-label={t("filterTransactionHistory")} className="mobile-filter-sheet-form" onSubmit={(event) => {
          event.preventDefault();
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries({ ...draft, search })) {
            if (value && (key === "search" || value !== "all")) params.set(key, value);
          }
          router.push(`/transactions${params.size ? `?${params}` : ""}`, { scroll: false });
          setOpen(false);
        }}>
          <div className="mobile-filter-sheet-body">
            <TransactionFilterFields data={data} filters={draft} onChange={setDraft} />
            <p className="hint">{t("transferFilterHint")}</p>
          </div>
          <div className="mobile-filter-sheet-actions">
            <Button type="button" variant="outline" onClick={() => setDraft(transactionFiltersSchema.parse({}))}>{t("reset")}</Button>
            <Button type="submit">{t("applyFilters")}</Button>
          </div>
        </Form>
      </SheetContent>
    </Sheet>
  </div>;
}
