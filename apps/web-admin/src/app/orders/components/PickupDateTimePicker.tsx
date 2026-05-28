"use client";

import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { CalendarDateTime } from "@internationalized/date";
import { useMemo } from "react";

import { adminLabelClass } from "@/lib/admin-form-classes";

export function parseLocalDatetime(s: string): CalendarDateTime | null {
  if (!s?.trim()) return null;
  const [datePart, timePart] = s.trim().split("T");
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  let hh = 0;
  let mm = 0;
  if (timePart) {
    const [a, b] = timePart.split(":");
    hh = Number.parseInt(a ?? "0", 10) || 0;
    mm = Number.parseInt(b ?? "0", 10) || 0;
  }
  return new CalendarDateTime(y, m, d, hh, mm);
}

function cdtToLocalString(ct: CalendarDateTime): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ct.year}-${pad(ct.month)}-${pad(ct.day)}T${pad(ct.hour)}:${pad(ct.minute)}`;
}

/** ISO 8601 từ chuỗi datetime-local */
export function localDatetimeToIso(s: string): string | null {
  const cdt = parseLocalDatetime(s);
  if (!cdt) return null;
  const d = new Date(
    cdt.year,
    cdt.month - 1,
    cdt.day,
    cdt.hour,
    cdt.minute,
  );
  return d.toISOString();
}

type Props = {
  value: string;
  onChange: (localDatetime: string) => void;
  /** Mặc định: Giờ lấy (local) */
  label?: string;
};

/** Giờ lấy — HeroUI DatePicker (ngày + giờ), giá trị dạng `YYYY-MM-DDTHH:mm` local. */
export function PickupDateTimePicker({
  value,
  onChange,
  label = "Giờ lấy (local)",
}: Props) {
  const parsed = useMemo(() => parseLocalDatetime(value), [value]);

  return (
    <DatePicker
      className="flex w-full max-w-md flex-col gap-2.5"
      granularity="minute"
      hourCycle={24}
      value={parsed ?? undefined}
      onChange={(v) => {
        if (!v) {
          onChange("");
          return;
        }
        if (!("hour" in v)) return;
        onChange(cdtToLocalString(v as CalendarDateTime));
      }}
    >
      <Label className={adminLabelClass}>
        {label}
      </Label>
      <DateField.Group
        className="flex min-h-11 w-full items-center rounded-xl border border-black/10 bg-[#fafafa] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
        fullWidth
        variant="secondary"
      >
        <DateField.InputContainer className="flex min-h-0 min-w-0 flex-1 items-center px-1">
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix className="shrink-0 pr-1">
          <DatePicker.Trigger
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-black/6"
          >
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover className="rounded-2xl p-2 shadow-lg">
        <Calendar aria-label="Chọn ngày giờ lấy hàng">
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
