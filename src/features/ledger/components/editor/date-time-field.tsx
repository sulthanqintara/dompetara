import { useId, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const date = new Date(`${value.slice(0, 10)}T12:00`);
  return (
    <div className="form-row">
      <div className="form-field">
        <Label htmlFor={`${id}-date`}>Date</Label>
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
            {date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="calendar-popover" align="start">
            <Calendar
              mode="single"
              required
              selected={date}
              defaultMonth={date}
              onSelect={(next) => {
                const dateTime = `${localDate(next).slice(0, 10)}T${value.slice(11)}`;
                setValue(dateTime);
                onDateChange?.(dateTime);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="form-field">
        <Label htmlFor={`${id}-time`}>Time</Label>
        <Input
          id={`${id}-time`}
          type="time"
          required
          value={value.slice(11)}
          onChange={(e) => {
            const dateTime = `${value.slice(0, 10)}T${e.target.value}`;
            setValue(dateTime);
            onDateChange?.(dateTime);
          }}
        />
      </div>
      <input type="hidden" name="date" value={value} />
    </div>
  );
}
