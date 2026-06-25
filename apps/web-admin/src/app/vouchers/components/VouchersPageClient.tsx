"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Pagination,
  Select,
  Table,
  Text,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Pencil, Plus, Search, TicketPercent, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClassProduct,
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminVoucher,
  fetchAdminVoucherStats,
  fetchAdminVouchers,
} from "@/services/admin/vouchers-api";
import type { AdminVoucher } from "@/services/admin/types";

import { VoucherFormModal } from "./VoucherFormModal";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

const PAGE_SIZE = 8;

type TabFilter = "all" | "active" | "inactive";

type SortKey = "newest" | "oldest" | "code";

function usePaginationWindow(
  current: number,
  totalPages: number,
  max = 5,
): number[] {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

function discountLabel(v: AdminVoucher): string {
  const dv = Number.parseFloat(v.discountValue);
  if (v.discountType === "percent") return `${dv}%`;
  return formatVnd(dv);
}

function typeLabel(t: AdminVoucher["discountType"]): string {
  return t === "percent" ? "Phần trăm" : "Số tiền cố định";
}

function formatExpiry(iso: string | null): { text: string; urgent: boolean } {
  if (!iso) return { text: "—", urgent: false };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: "—", urgent: false };
  const now = Date.now();
  const urgent = d.getTime() < now;
  const near =
    !urgent && d.getTime() - now < 7 * 24 * 3600 * 1000;
  return {
    text: d.toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    urgent: urgent || near,
  };
}

function formatHoursShort(h: number): string {
  if (h < 72) return `${Math.round(h)}h`;
  return `${Math.round((h / 24) * 10) / 10} ngày`;
}

function compactVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return formatVnd(n);
}

export function VouchersPageClient() {
  const qc = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminVoucher | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const listQuery = useQuery({
    queryKey: adminKeys.vouchers,
    queryFn: () => fetchAdminVouchers(),
  });

  const statsQuery = useQuery({
    queryKey: adminKeys.voucherStats,
    queryFn: () => fetchAdminVoucherStats(),
  });

  const vouchers = listQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (tab === "active" && !v.isActive) return false;
      if (tab === "inactive" && v.isActive) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q)
      );
    });
  }, [vouchers, debouncedSearch, tab]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "newest") {
      arr.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "oldest") {
      arr.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else {
      arr.sort((a, b) => a.code.localeCompare(b.code));
    }
    return arr;
  }, [filtered, sort]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const slice = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  const pageWindow = usePaginationWindow(currentPage, pageCount, 5);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab, sort]);

  const deleteMut = useMutation({
    mutationFn: deleteAdminVoucher,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.vouchers });
      await qc.invalidateQueries({ queryKey: adminKeys.voucherStats });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (v: AdminVoucher) => {
    setEditTarget(v);
    setFormOpen(true);
  };

  const handleDelete = async (v: AdminVoucher) => {
    const ok = await confirm({
      title: "Xoá voucher?",
      description: `Xoá mã “${v.code}”? Không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xoá",
    });
    if (!ok) return;
    deleteMut.mutate(v.id);
  };

  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Khuyến mãi
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Quản lý voucher
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Tạo mã giảm giá, giới hạn lượt dùng và thời hạn. Số lượt “gán” hiển thị
            từ chương trình giới thiệu (Referral).
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white shadow-md shadow-[#1a3c34]/25"
          onPress={openCreate}
        >
          <Plus className="mr-2 size-4" />
          Tạo voucher mới
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Đang hiệu lực
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
              {statsQuery.isLoading ? "—" : (stats?.activeEffectiveCount ?? 0)}
            </p>
            <p className="text-xs text-emerald-700">
              / {stats?.totalVouchers ?? 0} mã trong hệ thống
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Trần giảm (ước tính)
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
              {statsQuery.isLoading
                ? "—"
                : compactVnd(stats?.estimatedMaxDiscountVnd ?? 0)}
            </p>
            <p className="text-xs text-foreground/50">Từ mã đang hiệu lực</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Đã gán (giới thiệu)
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#1a3c34]">
              {statsQuery.isLoading ? "—" : (stats?.referralIssuedTotal ?? 0)}
            </p>
            <p className="text-xs text-foreground/50">
              {stats?.referralRatePercent != null
                ? `${stats.referralRatePercent}% so với tổng hạn mức lượt`
                : "Không có hạn mức lượt để tính %"}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="space-y-1 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
              Sắp hết hạn
            </p>
            {stats?.nextExpiring ? (
              <>
                <p className="text-lg font-bold font-mono text-[#1a3c34]">
                  {stats.nextExpiring.code}
                </p>
                <p className="text-xs text-red-700">
                  còn {formatHoursShort(stats.nextExpiring.hoursLeft)}
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground/50">Không có mã sắp hết hạn</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
              aria-hidden
            />
            <Input
              aria-label="Tìm voucher"
              placeholder="Tìm theo tên hoặc mã…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-10 pr-4 text-sm ring-1 ring-black/6"
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tất cả"],
                  ["active", "Đang bật"],
                  ["inactive", "Đang tắt"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={tab === id ? "primary" : "ghost"}
                  className={
                    tab === id
                      ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                      : "rounded-full"
                  }
                  onPress={() => setTab(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className={`w-40`}>
              <Label className={adminLabelClassProduct}>Sắp xếp</Label>
              <Select
                className="w-full"
                value={sort}
                onChange={(key) => {
                  if (key != null) setSort(key as SortKey);
                }}
                variant="secondary"
              >
                <Select.Trigger className={adminSelectTriggerCompactClass}>
                  <Select.Value className={adminSelectValueCompactClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom end">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item
                      id="newest"
                      textValue="Mới nhất"
                      className="rounded-lg text-sm"
                    >
                      Mới nhất trước
                    </ListBox.Item>
                    <ListBox.Item
                      id="oldest"
                      textValue="Cũ nhất"
                      className="rounded-lg text-sm"
                    >
                      Cũ nhất trước
                    </ListBox.Item>
                    <ListBox.Item
                      id="code"
                      textValue="Mã A-Z"
                      className="rounded-lg text-sm"
                    >
                      Mã A → Z
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <CardContent className="border-b border-black/6 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TicketPercent className="size-5 text-[#1a3c34]" aria-hidden />
              <p className="text-sm font-semibold text-[#1a3c34]">
                Danh sách voucher
              </p>
            </div>
            <Text className="text-xs text-foreground/45">
              Hiển thị {slice.length} / {total} mã
              {listQuery.isLoading ? " · Đang tải…" : ""}
            </Text>
          </div>
        </CardContent>
        <Table.Root className="min-w-[1020px]" aria-label="Danh sách voucher">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  textValue="Tên"
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Tên
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Mã
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Loại
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Giảm
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Hết hạn
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Gán
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Trạng thái
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {listQuery.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                  : slice.map((v) => {
                    const exp = formatExpiry(v.endsAt);
                    return (
                      <Table.Row key={v.id}>
                        <Table.Cell className="max-w-[220px] px-5 py-3">
                          <span className="font-semibold text-[#1a3c34]">
                            {v.name}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <span className="rounded-lg bg-[#f3f4f6] px-2 py-1 font-mono text-xs font-semibold text-[#1a3c34] ring-1 ring-black/6">
                            {v.code}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm text-foreground/75">
                          {typeLabel(v.discountType)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm font-medium tabular-nums">
                          {discountLabel(v)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm">
                          <span
                            className={
                              exp.urgent
                                ? "font-medium text-red-700"
                                : "text-foreground/80"
                            }
                          >
                            {exp.text}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 tabular-nums text-sm text-foreground/75">
                          {v.issuedCount ?? 0}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <div className="flex flex-col gap-1">
                            {v.isActive ? (
                              <Chip
                                size="sm"
                                variant="soft"
                                className="border-0 bg-emerald-500/15 font-bold uppercase tracking-wide text-emerald-900"
                              >
                                Hoạt động
                              </Chip>
                            ) : (
                              <Chip
                                size="sm"
                                variant="soft"
                                className="border-0 bg-zinc-400/15 font-bold uppercase tracking-wide text-zinc-700"
                              >
                                Tắt
                              </Chip>
                            )}
                            {v.isWelcome && (
                              <Chip
                                size="sm"
                                variant="soft"
                                className="border-0 bg-amber-400/20 font-bold uppercase tracking-wide text-amber-800"
                              >
                                Chào mừng
                              </Chip>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-right">
                          <div className="inline-flex justify-end gap-1">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Sửa"
                              onPress={() => openEdit(v)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              aria-label="Xoá"
                              onPress={() => void handleDelete(v)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
        {!listQuery.isLoading && slice.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground/45">
            Không có voucher nào — tạo mới hoặc đổi bộ lọc.
          </p>
        ) : null}
      </Card>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground/50">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} / {total} voucher
          </p>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={currentPage <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === currentPage}
                    onPress={() => setPage(n)}
                    className={
                      n === currentPage
                        ? "min-w-9 rounded-full bg-[#1a3c34] font-semibold text-white"
                        : "min-w-9 rounded-full"
                    }
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={currentPage >= pageCount}
                  onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      ) : null}

      <VoucherFormModal
        voucher={editTarget}
        isOpen={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
