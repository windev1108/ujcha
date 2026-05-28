"use client";

import { Button, Input, Label, ListBox, Select } from "@heroui/react";
import { Filter, Search } from "lucide-react";

import {
  adminFieldStack,
  adminLabelClassFilter,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import type { AdminOrderStatus, AdminOrderType } from "@/services/admin/types";

import { OrderDateRangePicker } from "./OrderDateRangePicker";

const TYPE_ALL = "__all__";
const STATUS_ALL = "__all__";

export type OrderFiltersValue = {
  q: string;
  type: AdminOrderType | "";
  status: AdminOrderStatus | "";
  from: string;
  to: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thisWeekRange(): { from: string; to: string } {
  const now = new Date();
  const diffToMonday = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toISODate(monday), to: toISODate(sunday) };
}

function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISODate(first), to: toISODate(last) };
}

type Props = {
  value: OrderFiltersValue;
  onChange: (next: OrderFiltersValue) => void;
  onApply: () => void;
  onQuickApply: (partial: Pick<OrderFiltersValue, "from" | "to">) => void;
};

const typeOptions: { id: string; label: string }[] = [
  { id: TYPE_ALL, label: "Mọi loại" },
  { id: "delivery", label: "Giao hàng" },
  { id: "table", label: "Tại bàn" },
  { id: "pickup", label: "Mang đi" },
];

const statusOptions: { id: string; label: string }[] = [
  { id: STATUS_ALL, label: "Mọi trạng thái" },
  { id: "pending", label: "Chờ xác nhận" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "preparing", label: "Đang làm món" },
  { id: "ready", label: "Sẵn sàng" },
  { id: "delivering", label: "Đang giao" },
  { id: "completed", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" },
];

export function OrderFilters({ value, onChange, onApply, onQuickApply }: Props) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/55">
          <Filter className="size-3.5" aria-hidden />
          Lọc nhanh
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs"
          onPress={() => {
            const iso = toISODate(new Date());
            onQuickApply({ from: iso, to: iso });
          }}
        >
          Hôm nay
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs"
          onPress={() => onQuickApply(thisWeekRange())}
        >
          Tuần này
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs"
          onPress={() => onQuickApply(thisMonthRange())}
        >
          Tháng này
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start lg:gap-x-4 lg:gap-y-3">
        <div className={`lg:col-span-4 ${adminFieldStack}`}>
          <Label className={adminLabelClassFilter}>
            Mã đơn / khách
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35"
              aria-hidden
            />
            <Input
              value={value.q}
              onChange={(e) => onChange({ ...value, q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
              placeholder="Mã thanh toán, tên, SĐT, UUID đơn…"
              className="w-full rounded-xl border border-black/10 bg-[#fafafa] py-2 pl-9 pr-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
              aria-label="Tìm đơn"
            />
          </div>
        </div>

        <div className={`lg:col-span-2 ${adminFieldStack}`}>
          <Label className={adminLabelClassFilter}>
            Loại dịch vụ
          </Label>
          <Select
            className="w-full"
            value={value.type === "" ? TYPE_ALL : value.type}
            onChange={(key) => {
              const k = key == null ? TYPE_ALL : String(key);
              onChange({
                ...value,
                type: k === TYPE_ALL ? "" : (k as AdminOrderType),
              });
            }}
            variant="secondary"
          >
            <Select.Trigger className={adminSelectTriggerClass}>
              <Select.Value className={adminSelectValueClass} />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom start">
              <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                {typeOptions.map((o) => (
                  <ListBox.Item
                    key={o.id}
                    id={o.id}
                    textValue={o.label}
                    className="rounded-lg text-sm"
                  >
                    {o.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className={`lg:col-span-2 ${adminFieldStack}`}>
          <Label className={adminLabelClassFilter}>
            Trạng thái
          </Label>
          <Select
            className="w-full"
            value={value.status === "" ? STATUS_ALL : value.status}
            onChange={(key) => {
              const k = key == null ? STATUS_ALL : String(key);
              onChange({
                ...value,
                status: k === STATUS_ALL ? "" : (k as AdminOrderStatus),
              });
            }}
            variant="secondary"
          >
            <Select.Trigger className={adminSelectTriggerClass}>
              <Select.Value className={adminSelectValueClass} />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom start">
              <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                {statusOptions.map((o) => (
                  <ListBox.Item
                    key={o.id}
                    id={o.id}
                    textValue={o.label}
                    className="rounded-lg text-sm"
                  >
                    {o.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <OrderDateRangePicker
            label="Khoảng ngày (createdAt)"
            from={value.from}
            to={value.to}
            onRangeChange={(from, to) => onChange({ ...value, from, to })}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-black/5 pt-4">
        <Button
          className="rounded-xl bg-[#1a3c34] px-6 font-semibold text-white"
          onPress={onApply}
        >
          Áp dụng bộ lọc
        </Button>
      </div>
    </div>
  );
}
