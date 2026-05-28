"use client";

import { Button, Table } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminFeedback,
  fetchAdminFeedbacks,
  fetchAdminFeedbackStats,
} from "@/services/admin/feedback-api";
import type { AdminFeedback } from "@/services/admin/types";

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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5a8f7a]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[#1a3c34]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-foreground/45">{sub}</p>}
    </div>
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

  const { data: stats } = useQuery({
    queryKey: adminKeys.feedbackStats,
    queryFn: fetchAdminFeedbackStats,
  });

  const { data, isLoading } = useQuery({
    queryKey: adminKeys.feedbacks({ page, pageSize: PAGE_SIZE, rating: ratingFilter }),
    queryFn: () => fetchAdminFeedbacks(page, PAGE_SIZE, ratingFilter),
    placeholderData: (prev) => prev,
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdminFeedback,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.feedbacks() });
      void qc.invalidateQueries({ queryKey: adminKeys.feedbackStats });
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
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          Khách hàng
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          Phản hồi khách hàng
        </h1>
        <p className="mt-2 text-sm text-foreground/55">
          Xem phản hồi được gửi từ ứng dụng. Admin chỉ có thể xem và xóa.
        </p>
      </header>

      {/* Stats */}
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
            ) : (
              "—"
            )
          }
          sub="Trên thang 5 sao"
        />
        <StatCard
          label="Có đánh giá sao"
          value={
            stats
              ? Object.values(stats.byRating).reduce((a, b) => a + b, 0)
              : "—"
          }
          sub={`/${stats?.total ?? 0} phản hồi`}
        />
      </div>

      {/* Rating filter chips */}
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
              <span className="ml-1.5 opacity-70">
                ({stats.byRating[f.value]})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-foreground/40">
              Đang tải…
            </div>
          ) : !data?.items.length ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-foreground/35">
              <MessageSquare className="size-10" />
              <p className="text-sm">
                {ratingFilter != null
                  ? `Không có phản hồi ${ratingFilter} sao.`
                  : "Chưa có phản hồi nào."}
              </p>
            </div>
          ) : (
            <Table.Root aria-label="Phản hồi khách hàng">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column isRowHeader className="w-36 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Họ tên
                    </Table.Column>
                    <Table.Column className="w-44 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Liên hệ
                    </Table.Column>
                    <Table.Column className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Nội dung
                    </Table.Column>
                    <Table.Column className="w-28 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Đánh giá
                    </Table.Column>
                    <Table.Column className="w-36 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Thời gian
                    </Table.Column>
                    <Table.Column className="w-16 px-4 py-3" />
                  </Table.Header>
                  <Table.Body>
                    {data.items.map((fb) => (
                      <Table.Row key={fb.id} className="border-t border-black/4 hover:bg-black/[0.02]">
                        <Table.Cell className="px-4 py-3 text-sm font-medium text-foreground">
                          {fb.name ?? <span className="text-foreground/30">Ẩn danh</span>}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {fb.email && <span className="text-xs text-foreground/70">{fb.email}</span>}
                            {fb.phone && <span className="text-xs text-foreground/70">{fb.phone}</span>}
                            {!fb.email && !fb.phone && <span className="text-xs text-foreground/30">—</span>}
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
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3">
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
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table.Root>
          )}
      </div>

      {/* Pagination */}
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
              onPress={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Trước
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl border border-black/10"
              isDisabled={page >= totalPages}
              onPress={() => setPage((p) => p + 1)}
            >
              Sau
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
