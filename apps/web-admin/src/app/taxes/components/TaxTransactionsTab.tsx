"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Table,
  Text,
} from "@heroui/react";

import {
  adminFieldStack,
  adminLabelClassFilter,
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { fetchTaxTransactions } from "@/services/admin/taxes-api";
import { formatVnd } from "@/lib/product-display";
import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";
import type { AdminOrderStatus, AdminOrderType } from "@/services/admin/types";

const TYPE_ALL = "__all__";
const STATUS_ALL = "__all__";

const typeOptions = [
  { id: TYPE_ALL, label: "Mọi loại" },
  { id: "delivery", label: "Giao hàng" },
  { id: "table", label: "Tại bàn" },
  { id: "pickup", label: "Mang về" },
];

const statusOptions = [
  { id: STATUS_ALL, label: "Mọi trạng thái" },
  { id: "pending", label: "Chờ xử lý" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "preparing", label: "Đang làm" },
  { id: "ready", label: "Sẵn sàng" },
  { id: "delivering", label: "Đang giao" },
  { id: "completed", label: "Hoàn thành" },
  { id: "cancelled", label: "Đã huỷ" },
];

const typeLabel: Record<string, string> = { delivery: "Giao hàng", table: "Tại bàn", pickup: "Mang về" };

function todayStr() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const PAGE_SIZE = 20;

function PaymentChip({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Chip size="sm" variant="soft" className="border-0 bg-emerald-500/15 font-bold uppercase tracking-wide text-emerald-900">
        Đã TT
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" className="border-0 bg-amber-500/15 font-bold uppercase tracking-wide text-amber-900">
      Chưa TT
    </Chip>
  );
}

export function TaxTransactionsTab() {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<AdminOrderType | "">("");
  const [status, setStatus] = useState<AdminOrderStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.taxTransactions({ from, to, q, status, type, page, pageSize: PAGE_SIZE }),
    queryFn: () =>
      fetchTaxTransactions({
        from,
        to,
        q: q || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function applySearch() {
    setQ(qInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter card */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-12 lg:items-end">
          {/* Search */}
          <div className={`lg:col-span-4 ${adminFieldStack}`}>
            <Label className={adminLabelClassFilter}>Mã đơn / khách</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/35"
                aria-hidden
              />
              <Input
                aria-label="Tìm giao dịch"
                placeholder="Mã đơn, tên, SĐT khách…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                className="w-full rounded-xl border border-black/10 bg-[#fafafa] py-2 pl-9 pr-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
              />
            </div>
          </div>

          {/* Type */}
          <div className={`lg:col-span-2 ${adminFieldStack}`}>
            <Label className={adminLabelClassFilter}>Loại đơn</Label>
            <Select
              className="w-full"
              value={type === "" ? TYPE_ALL : type}
              onChange={(key) => {
                const k = key == null ? TYPE_ALL : String(key);
                setType(k === TYPE_ALL ? "" : (k as AdminOrderType));
                setPage(1);
              }}
              variant="secondary"
            >
              <Select.Trigger className={adminSelectTriggerCompactClass}>
                <Select.Value className={adminSelectValueCompactClass} />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                  {typeOptions.map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label} className="rounded-lg text-sm">
                      {o.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Status */}
          <div className={`lg:col-span-2 ${adminFieldStack}`}>
            <Label className={adminLabelClassFilter}>Trạng thái</Label>
            <Select
              className="w-full"
              value={status === "" ? STATUS_ALL : status}
              onChange={(key) => {
                const k = key == null ? STATUS_ALL : String(key);
                setStatus(k === STATUS_ALL ? "" : (k as AdminOrderStatus));
                setPage(1);
              }}
              variant="secondary"
            >
              <Select.Trigger className={adminSelectTriggerCompactClass}>
                <Select.Value className={adminSelectValueCompactClass} />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ListBox className="max-h-72 min-w-(--trigger-width) overflow-y-auto outline-none">
                  {statusOptions.map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label} className="rounded-lg text-sm">
                      {o.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Date range */}
          <div className="min-w-0 lg:col-span-3">
            <OrderDateRangePicker
              label="Khoảng ngày"
              from={from}
              to={to}
              onRangeChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }}
              className="w-full"
            />
          </div>

          {/* Apply */}
          <div className="lg:col-span-1 flex items-end">
            <Button
              className="w-full rounded-xl bg-[#1a3c34] font-semibold text-white"
              onPress={applySearch}
            >
              Tìm
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <CardContent className="border-b border-black/6 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1a3c34]">Giao dịch & Thuế GTGT</p>
            <Text className="text-xs text-foreground/45">
              {data ? `${data.total} giao dịch` : ""}
              {isLoading ? " · Đang tải…" : ""}
            </Text>
          </div>
        </CardContent>
        <Table.Root className="min-w-[860px]" aria-label="Danh sách giao dịch thuế">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column isRowHeader className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Ngày
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Mã đơn
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Khách hàng
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Loại
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thanh toán
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Doanh thu
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  VAT %
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thuế GTGT
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                  : data?.items.length === 0
                    ? (
                      <Table.Row>
                        <Table.Cell colSpan={8} className="px-5 py-16 text-center text-sm text-foreground/40">
                          Không có giao dịch trong khoảng thời gian này.
                        </Table.Cell>
                      </Table.Row>
                    )
                    : (data?.items ?? []).map((row) => {
                      const vnDate = new Date(new Date(row.createdAt).getTime() + 7 * 3600_000);
                      const dateStr = `${String(vnDate.getUTCDate()).padStart(2, "0")}/${String(vnDate.getUTCMonth() + 1).padStart(2, "0")} ${String(vnDate.getUTCHours()).padStart(2, "0")}:${String(vnDate.getUTCMinutes()).padStart(2, "0")}`;
                      const vatPct = parseFloat(row.vatRate);
                      return (
                        <Table.Row key={row.id}>
                          <Table.Cell className="px-5 py-3 text-xs tabular-nums text-foreground/60">
                            {dateStr}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3">
                            <span className="rounded-lg bg-[#f3f4f6] px-2 py-1 font-mono text-xs font-semibold text-[#1a3c34] ring-1 ring-black/6">
                              {row.paymentCode}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-sm text-foreground/70">
                            {row.user
                              ? row.user.name
                              : <span className="italic text-foreground/35">Khách lẻ</span>}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3">
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium">
                              {typeLabel[row.type] ?? row.type}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3">
                            <PaymentChip status={row.paymentStatus} />
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right font-medium tabular-nums">
                            {formatVnd(Number(row.finalAmount))}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right text-xs tabular-nums text-foreground/55">
                            {vatPct > 0 ? `${vatPct.toFixed(1)}%` : <span className="text-foreground/25">—</span>}
                          </Table.Cell>
                          <Table.Cell className="px-5 py-3 text-right text-sm font-medium tabular-nums text-blue-700">
                            {Number(row.vatAmount) > 0
                              ? formatVnd(Number(row.vatAmount))
                              : <span className="text-foreground/25">—</span>}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>

        {/* Pagination */}
        {totalPages > 1 && (
          <CardContent className="flex items-center justify-between border-t border-black/5 px-5 py-3">
            <Text className="text-xs text-foreground/40">
              Trang {page} / {totalPages}
            </Text>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg text-xs"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                isDisabled={page <= 1}
              >
                ← Trước
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg text-xs"
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                isDisabled={page >= totalPages}
              >
                Sau →
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
