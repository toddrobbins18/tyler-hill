import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { amPmPartsToHHmm, parseAmPmParts } from "@/lib/amPmTime";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type AmPmTimeInputProps = {
  value: string;
  onChange: (hhmm: string) => void;
  label?: string;
  optional?: boolean;
  className?: string;
  id?: string;
};

export function AmPmTimeInput({
  value,
  onChange,
  label,
  optional,
  className,
  id,
}: AmPmTimeInputProps) {
  const parts = parseAmPmParts(value);
  const hour = parts?.hour ?? 12;
  const minute = parts?.minute ?? 0;
  const period = parts?.period ?? "PM";
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);

  const emit = (nextHour: number, nextMinute: number, nextPeriod: "AM" | "PM") => {
    onChange(amPmPartsToHHmm(nextHour, nextMinute, nextPeriod));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
        </Label>
      ) : null}
      <div className="flex gap-2" id={id}>
        <Select
          value={parts ? String(hour) : undefined}
          onValueChange={(next) => emit(parseInt(next, 10), minute, period)}
        >
          <SelectTrigger className="w-[72px]">
            <SelectValue placeholder="Hr" />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={parts ? String(minute) : undefined}
          onValueChange={(next) => emit(hour, parseInt(next, 10), period)}
        >
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {minuteOptions.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={parts ? period : undefined}
          onValueChange={(next) => emit(hour, minute, next as "AM" | "PM")}
        >
          <SelectTrigger className="w-[84px]">
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
        {optional && value ? (
          <Button type="button" variant="ghost" size="sm" className="px-2" onClick={() => onChange("")}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
