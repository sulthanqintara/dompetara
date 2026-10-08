import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover } from "@/components/ui/popover";
import { PopoverTrigger } from "@/components/ui/popover-trigger";
import { PopoverContent } from "@/components/ui/popover-content";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const monthNames = Array.from({ length: 12 }, (_, month) =>
    new Date(2000, month, 1).toLocaleDateString(locale, { month: "short" }),
  );
  const date = new Date(`${value}-01T12:00`);
  return (
    <div className="form-field">
      <Label htmlFor={id}>{t("period")}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(Number(value.slice(0, 4)));
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              className="date-trigger"
              aria-label={t("month")}
            />
          }
        >
          {date.toLocaleDateString(locale, {
            month: "long",
            year: "numeric",
          })}
          <CalendarIcon />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="month-popover"
          aria-label={t("chooseReportingMonth")}
        >
          <div className="month-heading">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("previousYear")}
              disabled={year <= 1}
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft />
            </Button>
            <Label htmlFor={`${id}-year`} className="sr-only">
              {t("year")}
            </Label>
            <Input
              id={`${id}-year`}
              type="number"
              min={1}
              max={9999}
              value={year}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isInteger(next) && next >= 1 && next <= 9999)
                  setYear(next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("nextYear")}
              disabled={year >= 9999}
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="month-grid">
            {monthNames.map((name, month) => {
              const next = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
              return (
                <Button
                  key={month}
                  variant={value === next ? "default" : "ghost"}
                  aria-pressed={value === next}
                  aria-label={`${name} ${year}`}
                  onClick={() => {
                    onChange(next);
                    setOpen(false);
                  }}
                >
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
