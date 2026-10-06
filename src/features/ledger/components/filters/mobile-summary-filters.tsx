import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SheetContent } from "@/components/ui/sheet-content";
import { SheetTitle } from "@/components/ui/sheet-title";
import { SheetDescription } from "@/components/ui/sheet-description";
import { useSidebar } from "@/components/ui/use-sidebar";
import { currencies, type Currency } from "../../ledger";
import { periodLabel, periodRange, validPeriod, type Period } from "../../derive";
import { LedgerSelect } from "../shared/ledger-select";
import { PeriodPicker } from "./period-picker";

export function MobileSummaryFilters({ period, currency, onPeriodChange, onCurrencyChange }: {
  period: Period;
  currency: Currency;
  onPeriodChange: (period: Period) => void;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const { isPhone } = useSidebar();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(period);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const trigger = useRef<HTMLButtonElement>(null);
  const month = "month" in period ? period.month : null;
  const range = periodRange(draft);
  const valid = validPeriod(range.start, range.end);
  const label = month ? new Date(`${month}-01T12:00`).toLocaleDateString("en", { month: "short", year: "numeric" }) : "Custom dates";
  const moveMonth = (direction: number) => {
    if (!month) return;
    const [year, number] = month.split("-").map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year, number - 1 + direction, 1);
    onPeriodChange({ month: `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` });
  };
  return <>
    <div className="mobile-summary-filters">
      {month && <Button variant="outline" size="icon" aria-label="Previous month" disabled={month === "0001-01"} onClick={() => moveMonth(-1)}><ChevronLeft /></Button>}
      <Button ref={trigger} variant="outline" className="summary-period-trigger" aria-label={`Change period: ${periodLabel(period)}`}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => {
          setDraft(period);
          setDraftCurrency(currency);
          setOpen(true);
        }}><span>{label}</span><ChevronDown /></Button>
      {month && <Button variant="outline" size="icon" aria-label="Next month" disabled={month === "9999-12"} onClick={() => moveMonth(1)}><ChevronRight /></Button>}
      <LedgerSelect label="Currency" compact value={currency} options={currencies.map((value) => ({ value, label: value }))}
        onValueChange={(value) => onCurrencyChange(value as Currency)} />
    </div>
    {!month && <p className="mobile-period-range">{periodLabel(period)}</p>}
    <Sheet open={open && isPhone} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="mobile-filter-sheet" finalFocus={trigger}>
        <div className="mobile-filter-sheet-heading">
          <SheetTitle>Period and summary currency</SheetTitle>
          <SheetDescription>Choose the period and currency used for summary totals.</SheetDescription>
        </div>
        <div className="mobile-filter-sheet-body">
          <PeriodPicker key={open ? "open" : "closed"} period={draft} onChange={setDraft} draftOnly />
          <LedgerSelect label="Summary currency" value={draftCurrency} options={currencies.map((value) => ({ value, label: value }))}
            onValueChange={(value) => setDraftCurrency(value as Currency)} />
          {!valid && <p role="status" className="hint">Enter valid dates with the end on or after the start.</p>}
        </div>
        <div className="mobile-filter-sheet-actions">
          <Button disabled={!valid} onClick={() => {
            onPeriodChange(draft);
            onCurrencyChange(draftCurrency);
            setOpen(false);
          }}>Apply period</Button>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
