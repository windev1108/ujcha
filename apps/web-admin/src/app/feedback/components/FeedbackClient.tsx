"use client";

import { Button, Table } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminKeys } from "@/services/admin/keys";
import {
  bulkPinFeedbacks,
  deleteAdminFeedback,
  fetchAdminFeedbacks,
  fetchAdminFeedbackStats,
  togglePinFeedback,
} from "@/services/admin/feedback-api";
import type { AdminFeedback } from "@/services/admin/types";
import { GrabFeedbackImportDialog } from "./GrabFeedbackImportDialog";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return (err as Error).message || "Có lỗi xảy ra.";
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-foreground/30">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-foreground/15"}`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5a8f7a]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1a3c34]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-foreground/45">{sub}</p>}
    </div>
  );
}

// Checkbox that matches the admin table style
function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className="group flex size-4 shrink-0 items-center justify-center rounded border-2 transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3c34]/40
        data-[state=checked]:border-[#1a3c34] data-[state=checked]:bg-[#1a3c34]
        data-[state=indeterminate]:border-[#1a3c34] data-[state=indeterminate]:bg-[#1a3c34]
        border-black/20 bg-white hover:border-[#1a3c34]/60"
      data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
    >
      {indeterminate ? (
        <span className="block h-0.5 w-2 rounded-full bg-white" />
      ) : checked ? (
        <span className="text-[8px] font-bold leading-none text-white">✓</span>
      ) : null}
    </button>
  );
}

const RATING_FILTERS = [
  { label: "Tất cả", value: undefined },
  { label: "5★", value: 5 },
  { label: "4★", value: 4 },
  { label: "3★", value: 3 },
  { label: "2★", value: 2 },
  { label: "1★", value: 1 },
];

const PAGE_SIZE = 20;

export function FeedbackClient() {
  const qc = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [grabDialogOpen, setGrabDialogOpen] = useState(false);
  // multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: stats } = useQuery({
    queryKey: adminKeys.feedbackStats,
    queryFn: fetchAdminFeedbackStats,
  });

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.feedbacks({ page, pageSize: PAGE_SIZE, rating: ratingFilter }),
    queryFn: () => fetchAdminFeedbacks(page, PAGE_SIZE, ratingFilter),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.feedbacks() });
    void qc.invalidateQueries({ queryKey: adminKeys.feedbackStats });
  };

  const deleteMut = useMutation({
    mutationFn: deleteAdminFeedback,
    onSuccess: invalidate,
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  // individual pin — track which ID is in flight via variables
  const pinMut = useMutation({
    mutationFn: togglePinFeedback,
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.feedbacks() }),
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  // bulk pin / unpin
  const bulkMut = useMutation({
    mutationFn: ({ ids, pin }: { ids: string[]; pin: boolean }) =>
      bulkPinFeedbacks(ids, pin),
    onSuccess: (res) => {
      invalidate();
      setSelectedIds(new Set());
      void showAlert(`Đã cập nhật ${res.updated} phản hồi.`, "Hoàn thành");
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const handleDelete = async (fb: AdminFeedback) => {
    const ok = await confirm({
      title: "Xóa phản hồi?",
      description: `Xóa phản hồi từ "${fb.name ?? fb.email ?? "Khách ẩn danh"}"? Hành động không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(fb.id);
  };

  const handleFilterChange = (rating: number | undefined) => {
    setRatingFilter(rating);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleGrabImported = () => invalidate();

  // select-all logic for current page
  const pageIds = data?.items.map((f) => f.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const selectionArray = [...selectedIds];

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">Khách hàng</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">Phản hồi khách hàng</h1>
          <p className="mt-2 text-sm text-foreground/55">Xem phản hồi được gửi từ ứng dụng. Admin chỉ có thể xem và xóa.</p>
        </div>
        <Button
          onPress={() => setGrabDialogOpen(true)}
          className="shrink-0 rounded-full border border-[#00b14f]/30 bg-[#00b14f]/8 px-4 py-2 text-sm font-semibold text-[#00b14f] hover:bg-[#00b14f]/15"
          variant="ghost"
        >
          <Download className="size-4" />
          Import từ GrabFood
        </Button>
      </header>

      <GrabFeedbackImportDialog
        isOpen={grabDialogOpen}
        onOpenChange={setGrabDialogOpen}
        onImported={handleGrabImported}
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng phản hồi"
          value={stats?.total ?? "—"}
          sub={`Hôm nay: +${stats?.todayCount ?? 0}`}
        />
        <StatCard
          label="Điểm trung bình"
          value={
            stats?.avgRating != null ? (
              <span className="flex items-center gap-1.5">
                {stats.avgRating}
                <Star className="size-5 fill-amber-400 text-amber-400" />
              </span>
            ) : "—"
          }
          sub="Trên thang 5 sao"
        />
        <StatCard
          label="Có đánh giá sao"
          value={stats ? Object.values(stats.byRating).reduce((a, b) => a + b, 0) : "—"}
          sub={`/${stats?.total ?? 0} phản hồi`}
        />
      </div>

      {/* ── Rating filter chips ── */}
      <div className="flex flex-wrap gap-2">
        {RATING_FILTERS.map((f) => (
          <button
            key={String(f.value)}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              ratingFilter === f.value
                ? "bg-[#1a3c34] text-white"
                : "bg-surface-card text-foreground/70 hover:bg-surface-tertiary"
            }`}
          >
            {f.label}
            {f.value != null && stats?.byRating[f.value] != null && (
              <span className="ml-1.5 opacity-70">({stats.byRating[f.value]})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-foreground/40">Đang tải…</div>
        ) : !data?.items.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-foreground/35">
            <MessageSquare className="size-10" />
            <p className="text-sm">
              {ratingFilter != null ? `Không có phản hồi ${ratingFilter} sao.` : "Chưa có phản hồi nào."}
            </p>
          </div>
        ) : (
          <Table.Root aria-label="Phản hồi khách hàng">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  {/* select-all checkbox */}
                  <Table.Column isRowHeader className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                      label="Chọn tất cả"
                    />
                  </Table.Column>
                  <Table.Column isRowHeader className="w-36 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Họ tên
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Nội dung
                  </Table.Column>
                  <Table.Column className="w-28 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Đánh giá
                  </Table.Column>
                  <Table.Column className="w-32 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thời gian
                  </Table.Column>
                  <Table.Column className="w-24 px-4 py-3" />
                </Table.Header>
                <Table.Body>
                  {data.items.map((fb) => {
                    const isGrab = fb.externalId?.startsWith("grab:");
                    const isSelected = selectedIds.has(fb.id);
                    const isPinning = pinMut.isPending && pinMut.variables === fb.id;

                    return (
                      <Table.Row
                        key={fb.id}
                        className={`border-t border-black/4 transition-colors ${
                          isSelected
                            ? "bg-[#1a3c34]/[0.04]"
                            : fb.isPinned
                            ? "bg-amber-50/50 hover:bg-amber-50/80"
                            : "hover:bg-black/[0.02]"
                        }`}
                      >
                        {/* per-row checkbox */}
                        <Table.Cell className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelectOne(fb.id)}
                            label={`Chọn ${fb.name ?? "ẩn danh"}`}
                          />
                        </Table.Cell>

                        {/* name + badges */}
                        <Table.Cell className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              {fb.isPinned && <Pin className="size-3 shrink-0 text-amber-500" />}
                              <span className="text-sm font-medium text-foreground">
                                {fb.name ?? <span className="text-foreground/30">Ẩn danh</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isGrab ? (
                                <span className="rounded-full bg-[#00b14f]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#00b14f]">GrabFood</span>
                              ) : (
                                <span className="rounded-full bg-[#1a3c34]/8 px-1.5 py-0.5 text-[9px] font-bold text-[#1a3c34]">UjCha</span>
                              )}
                              {fb.linkedProduct && (
                                <span className="max-w-[100px] truncate rounded-full bg-surface-card px-1.5 py-0.5 text-[9px] text-foreground/55">
                                  🔗 {fb.linkedProduct.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </Table.Cell>

                        <Table.Cell className="max-w-xs px-4 py-3">
                          <p className="line-clamp-2 text-sm text-foreground/80">{fb.content}</p>
                        </Table.Cell>

                        <Table.Cell className="px-4 py-3">
                          <StarRating rating={fb.rating} />
                        </Table.Cell>

                        <Table.Cell className="px-4 py-3 text-xs text-foreground/50">
                          {new Date(fb.createdAt).toLocaleString("vi-VN", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                          })}
                        </Table.Cell>

                        {/* actions */}
                        <Table.Cell className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* pin button with per-row spinner */}
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className={`rounded-xl transition ${
                                fb.isPinned
                                  ? "text-amber-500 hover:bg-amber-50"
                                  : "text-foreground/30 hover:bg-amber-50 hover:text-amber-500"
                              }`}
                              onPress={() => pinMut.mutate(fb.id)}
                              isDisabled={pinMut.isPending || bulkMut.isPending}
                              aria-label={fb.isPinned ? "Bỏ ghim" : "Ghim showcase"}
                              title={fb.isPinned ? "Bỏ ghim" : "Ghim lên showcase LP"}
                            >
                              {isPinning ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : fb.isPinned ? (
                                <PinOff className="size-4" />
                              ) : (
                                <Pin className="size-4" />
                              )}
                            </Button>

                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="rounded-xl text-foreground/40 hover:bg-red-50 hover:text-red-600"
                              onPress={() => void handleDelete(fb)}
                              isDisabled={deleteMut.isPending}
                              aria-label="Xóa phản hồi"
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
        )}
      </div>

      {/* ── Pagination ── */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground/50">
            {data.total} phản hồi · trang {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl border border-black/10"
              isDisabled={page <= 1}
              onPress={() => { setPage((p) => p - 1); setSelectedIds(new Set()); }}
            >
              <ChevronLeft className="size-4" />
              Trước
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl border border-black/10"
              isDisabled={page >= totalPages}
              onPress={() => { setPage((p) => p + 1); setSelectedIds(new Set()); }}
            >
              Sau
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Bulk action bar (fixed bottom, slides in when items selected) ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.25)]">
            {/* count */}
            <span className="min-w-[4rem] text-center text-sm font-semibold text-foreground">
              {selectionArray.length} mục
            </span>

            <div className="h-4 w-px bg-black/10" />

            {/* pin */}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              isDisabled={bulkMut.isPending}
              onPress={() => bulkMut.mutate({ ids: selectionArray, pin: true })}
            >
              {bulkMut.isPending && bulkMut.variables?.pin === true ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Pin className="size-3.5" />
              )}
              Ghim tất cả
            </Button>

            {/* unpin */}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl border border-black/10 bg-white px-3 font-semibold text-foreground/70 hover:bg-black/[0.03] disabled:opacity-50"
              isDisabled={bulkMut.isPending}
              onPress={() => bulkMut.mutate({ ids: selectionArray, pin: false })}
            >
              {bulkMut.isPending && bulkMut.variables?.pin === false ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PinOff className="size-3.5" />
              )}
              Bỏ ghim
            </Button>

            <div className="h-4 w-px bg-black/10" />

            {/* clear selection */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex size-7 items-center justify-center rounded-lg text-foreground/40 transition hover:bg-black/8 hover:text-foreground"
              aria-label="Bỏ chọn tất cả"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
