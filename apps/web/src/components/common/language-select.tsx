"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { ChevronDown, Globe } from "lucide-react";

export type LanguageOption = {
  id: string;
  label: string;
  /** Dùng cho accessibility / SelectValue (mặc định = label) */
  textValue?: string;
};

export type LanguageSelectProps = {
  /** Key đang chọn (vd. `vi`, `en`) */
  value: string;
  /** Khi user đổi ngôn ngữ — app (vd. Next) xử lý router / cookie */
  onChange: (nextId: string) => void;
  options: readonly LanguageOption[];
  /** Label ẩn cho accessibility */
  ariaLabel?: string;
  className?: string;
};

export function LanguageSelect({
  value,
  onChange,
  options,
  ariaLabel = "Ngôn ngữ",
  className,
}: LanguageSelectProps) {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key == null) return;
        onChange(String(key));
      }}
      className={className ?? "min-w-0 shrink-0"}
    >
      <Label className="sr-only">{ariaLabel}</Label>
      <Select.Trigger className="flex h-10 min-w-22 items-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 text-sm font-semibold uppercase tracking-wider text-foreground shadow-none outline-offset-2 ring-0 transition-colors hover:bg-foreground/6 data-pressed:bg-foreground/8">
        <Globe className="size-4 shrink-0 text-foreground/85" strokeWidth={1.5} aria-hidden />
        <Select.Value className="min-w-[2.5ch] flex-1 text-center tabular-nums" />
        {/* <Select.Indicator className="relative my-0! shrink-0">
          <ChevronDown className="size-4 text-foreground/55" strokeWidth={2} aria-hidden />
        </Select.Indicator> */}
      </Select.Trigger>
      <Select.Popover placement="bottom end" className="min-w-[--trigger-width]">
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item
              key={opt.id}
              id={opt.id}
              textValue={opt.textValue ?? opt.label}
              className="cursor-pointer px-3 py-2.5 text-sm font-semibold uppercase tracking-wide"
            >
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
