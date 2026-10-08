import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { id as indonesian, enUS } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover } from "@/components/ui/popover";
import { PopoverTrigger } from "@/components/ui/popover-trigger";
import { PopoverContent } from "@/components/ui/popover-content";
import { localDate } from "../../format";

export function DateTimeField({
  defaultValue,
  onDateChange,
}: {
  defaultValue: string;
  onDateChange?: (value: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("UI");
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [datePart, timePart = ""] = value.split("T");
  const date = new Date(`${datePart}T12:00`);
  const validDate = Number.isFinite(date.getTime());
  return (
    <div className="form-row">
      <div className="form-field">
        <Label htmlFor={`${id}-date`}>{t("date")}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={`${id}-date`}
                variant="outline"
                className="date-trigger"
              />
            }
          >
            {validDate
              ? date.toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : t("chooseDate")}
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="calendar-popover" align="start">
            <Calendar
              locale={locale === "id" ? indonesian : enUS}
              mode="single"
              required
              selected={validDate ? date : undefined}
              defaultMonth={validDate ? date : undefined}
              onSelect={(next) => {
                const dateTime = `${localDate(next).slice(0, 10)}T${timePart}`;
                setValue(dateTime);
                onDateChange?.(dateTime);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="form-field">
        <Label htmlFor={`${id}-time`}>{t("time")}</Label>
        <Input
          id={`${id}-time`}
          type="time"
          required
          value={timePart}
          onChange={(e) => {
            const dateTime = `${datePart}T${e.target.value}`;
            setValue(dateTime);
            onDateChange?.(dateTime);
          }}
        />
      </div>
      <input type="hidden" name="date" value={value} />
    </div>
  );
}
