"use client";

import {
  DateField,
  DateRangePicker,
  Label,
  RangeCalendar,
} from "@heroui/react";
import { parseDate, today, getLocalTimeZone } from "@internationalized/date";
import { useMemo } from "react";

import { adminLabelClassFilter } from "@/lib/admin-form-classes";

type Props = {
  id?: string;
  label: string;
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
  className?: string;
};

export function OrderDateRangePicker({
  id,
  label,
  from,
  to,
  onRangeChange,
  className,
}: Props) {
  const value = useMemo(() => {
    try {
      if (!from?.trim() || !to?.trim()) return null;
      return { start: parseDate(from), end: parseDate(to) };
    } catch {
      return null;
    }
  }, [from, to]);

  return (
    <DateRangePicker
      id={id}
      className={`min-w-0 flex flex-col gap-2.5 ${className ?? ""}`}
      value={value ?? undefined}
      onChange={(r) => {
        if (!r?.start || !r?.end) return;
        onRangeChange(r.start.toString(), r.end.toString());
      }}
      granularity="day"
    >
      <Label className={adminLabelClassFilter}>
        {label}
      </Label>
      <DateField.Group
        className="min-h-10 w-full min-w-0 rounded-xl border border-black/10 bg-[#fafafa] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
        fullWidth
        variant="secondary"
      >
        <DateField.InputContainer className="min-w-0 flex-1 px-1">
          <DateField.Input slot="start" className="min-w-0">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator className="shrink-0 px-0.5 text-foreground/35">
            –
          </DateRangePicker.RangeSeparator>
          <DateField.Input slot="end" className="min-w-0">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix className="shrink-0 pr-1">
          <DateRangePicker.Trigger
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-black/6"
          >
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover className="rounded-2xl p-2 shadow-lg">
        <RangeCalendar aria-label={label} maxValue={today(getLocalTimeZone())}>
          <RangeCalendar.Header>
            <RangeCalendar.YearPickerTrigger>
              <RangeCalendar.YearPickerTriggerHeading />
              <RangeCalendar.YearPickerTriggerIndicator />
            </RangeCalendar.YearPickerTrigger>
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => (
                <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
              )}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              {(date) => <RangeCalendar.Cell date={date} />}
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
