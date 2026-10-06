import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { periodLabel, periodRange, validPeriod, type Period } from "../../derive";
import { LedgerSelect } from "../shared/ledger-select";
import { MonthPicker } from "./month-picker";

export function PeriodPicker({ period, onChange, draftOnly = false }: {
  period: Period;
  onChange: (period: Period) => void;
  draftOnly?: boolean;
}) {
  const id = useId();
  const [mode, setMode] = useState("month" in period ? "month" : "custom");
  const [draft, setDraft] = useState(() => periodRange(period));
  const [error, setError] = useState("");
  return (
    <>
      <LedgerSelect
        label="Period type"
        value={mode}
        options={[{ value: "month", label: "Month" }, { value: "custom", label: "Custom dates" }]}
        onValueChange={(value) => {
          setMode(value);
          setDraft(periodRange(period));
          setError("");
          if (value === "month") {
            const start = periodRange(period).start;
            onChange({ month: validPeriod(start, start) ? start.slice(0, 7) : new Date().toISOString().slice(0, 7) });
          }
          else if (draftOnly) onChange(periodRange(period));
        }}
      />
      {mode === "month" ? (
        <MonthPicker value={periodRange(period).start.slice(0, 7)} onChange={(month) => onChange({ month })} />
      ) : (
        <form className="date-range-form" onSubmit={(event) => {
          event.preventDefault();
          if (!validPeriod(draft.start, draft.end)) {
            setError("Enter valid dates with the end on or after the start.");
            return;
          }
          setError("");
          onChange(draft);
        }}>
          <div className="form-field">
            <Label htmlFor={`${id}-start`}>Start date</Label>
            <Input id={`${id}-start`} name="start" type="date" required min="0001-01-01" max="9999-12-31"
              value={draft.start} onChange={(event) => {
                const next = { ...draft, start: event.target.value };
                setDraft(next);
                if (draftOnly) onChange(next);
              }} />
          </div>
          <div className="form-field">
            <Label htmlFor={`${id}-end`}>End date</Label>
            <Input id={`${id}-end`} name="end" type="date" required min="0001-01-01" max="9999-12-31"
              value={draft.end} onChange={(event) => {
                const next = { ...draft, end: event.target.value };
                setDraft(next);
                if (draftOnly) onChange(next);
              }} />
          </div>
          {!draftOnly && <Button type="submit">Apply dates</Button>}
          {error && <Alert variant="destructive" className="period-status">{error}</Alert>}
          {!draftOnly && <p className="period-status" role="status">
            Showing {periodLabel(period)}. Dates use your device timezone; both endpoints are included.
          </p>}
        </form>
      )}
    </>
  );
}
