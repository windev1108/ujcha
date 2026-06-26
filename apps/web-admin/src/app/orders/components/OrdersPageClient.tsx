"use client";

import { Button, Pagination } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  Download,
  ListChecks,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  bulkUpdateAdminOrderStatus,
  deleteAdminOrder,
  fetchAdminOrderStats,
  fetchAdminOrders,
} from "@/services/admin/orders-api";
import type { AdminOrder, AdminOrderStatus } from "@/services/admin/types";

import { AssignShipperModal } from "./AssignShipperModal";
import { BulkStatusModal } from "./BulkStatusModal";
import { OrderEditModal } from "./OrderEditModal";
import type { OrderFiltersValue } from "./OrderFilters";
import { OrderFilters } from "./OrderFilters";
import { OrderStats } from "./OrderStats";
import { OrderTable } from "./OrderTable";
import { customerDisplayName } from "./order-display";

const PAGE_SIZE = 10;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialFilters(): OrderFiltersValue {
  const t = todayISO();
  return { q: "", type: "", status: "", from: t, to: t, isGroupOrder: undefined };
}

function usePaginationWindow(
  current: number,
  totalPages: number,
  max = 5,
): number[] {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

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

function exportOrdersCsv(items: AdminOrder[]) {
  const header = [
    "paymentCode",
    "orderId",
    "customer",
    "phone",
    "type",
    "status",
    "paymentStatus",
    "finalAmount",
    "createdAt",
  ];
  const lines = [
    header.join(","),
    ...items.map((o) =>
      [
        o.paymentCode,
        o.id,
        customerDisplayName(o).replaceAll(",", " "),
        o.user?.phone ?? o.guestDeliveryPhone ?? "",
        o.type,
        o.status,
        o.paymentStatus,
        o.finalAmount,
        o.createdAt,
      ].join(","),
    ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  useOrderSocket();

  const [draft, setDraft] = useState<OrderFiltersValue>(initialFilters);
  const [applied, setApplied] = useState<OrderFiltersValue>(initialFilters);
  const [page, setPage] = useState(1);

  const [assignTarget, setAssignTarget] = useState<AdminOrder | null>(null);
  const [editTarget, setEditTarget] = useState<AdminOrder | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const listKey = adminKeys.orders({
    type: applied.type || undefined,
    status: applied.status || undefined,
    q: applied.q.trim() || undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
    page,
    pageSize: PAGE_SIZE,
    isGroupOrder: applied.isGroupOrder,
  });

  const statsKey = adminKeys.orderStats(applied.from, applied.to);

  const ordersQuery = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchAdminOrders({
        type: applied.type || undefined,
        status: applied.status || undefined,
        q: applied.q.trim() || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        page,
        pageSize: PAGE_SIZE,
        isGroupOrder: applied.isGroupOrder,
      }),
  });

  const statsQuery = useQuery({
    queryKey: statsKey,
    queryFn: () =>
      fetchAdminOrderStats({
        from: applied.from || undefined,
        to: applied.to || undefined,
      }),
  });

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageWindow = usePaginationWindow(safePage, totalPages, 5);

  const deleteMut = useMutation({
    mutationFn: deleteAdminOrder,
    onMutate: (id) => setBusyOrderId(id),
    onSettled: () => setBusyOrderId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const bulkMut = useMutation({
    mutationFn: ({ status }: { status: AdminOrderStatus }) =>
      bulkUpdateAdminOrderStatus([...selectedIds], status),
    onSuccess: async (data) => {
      setSelectedIds(new Set());
      setBulkModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void showAlert(
        `Đã cập nhật ${data.updated} đơn hàng.`,
        "Thành công",
      );
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const handleApply = () => {
    setApplied(draft);
    setPage(1);
  };

  const handleQuickApply = (partial: Pick<OrderFiltersValue, "from" | "to">) => {
    const next = { ...draft, ...partial };
    setDraft(next);
    setApplied(next);
    setPage(1);
  };

  const handleRefresh = () => {
    setSelectedIds(new Set());
    void ordersQuery.refetch();
    void statsQuery.refetch();
  };

  const handleReset = () => {
    const init = initialFilters();
    setDraft(init);
    setApplied(init);
    setPage(1);
    setSelectedIds(new Set());
  };

  const confirmDelete = async (o: AdminOrder) => {
    const ok = await confirm({
      title: "Xóa đơn hàng?",
      description: `Xóa đơn ${o.paymentCode || o.id.slice(0, 8)}? Nếu đơn đã có thanh toán, giao dịch đó sẽ bị xóa theo. Hành động này không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa đơn",
    });
    if (ok) deleteMut.mutate(o.id);
  };

  return (
    <div className="relative flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Vận hành
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Quản lý đơn hàng
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Theo dõi và xử lý đơn theo thời gian thực. Dùng bộ lọc ngày để đồng
            bộ KPI và danh sách.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full border-black/15"
            onPress={() => exportOrdersCsv(items)}
            isDisabled={items.length === 0}
          >
            <Download className="mr-2 size-4" />
            Xuất CSV (trang hiện tại)
          </Button>
          <Button
            variant="ghost"
            className="rounded-full"
            onPress={handleRefresh}
            isDisabled={ordersQuery.isFetching || statsQuery.isFetching}
          >
            <RefreshCw className="mr-2 size-4" />
            Làm mới
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
            onPress={() => router.push(ROUTES.ORDER_NEW)}
          >
            <Plus className="mr-2 size-4" />
            Đơn mới
          </Button>
        </div>
      </header>

      <OrderStats
        isLoading={statsQuery.isLoading}
        totalRevenue={statsQuery.data?.totalRevenue ?? 0}
        totalOrders={ordersQuery.isLoading ? 0 : total}
        activeOrders={statsQuery.data?.activeOrders ?? 0}
        avgOrderValue={statsQuery.data?.avgOrderValue ?? 0}
        fulfillmentSuccessPercent={
          statsQuery.data?.fulfillmentSuccessPercent ?? 0
        }
      />

      <OrderFilters
        value={draft}
        onChange={setDraft}
        onApply={handleApply}
        onQuickApply={handleQuickApply}
        onReset={handleReset}
      />

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-2xl border border-[#1a3c34]/20 bg-[#1a3c34]/[0.04] px-5 py-3"
          >
            <ListChecks className="size-4 shrink-0 text-[#1a3c34]" />
            <span className="flex-1 text-sm font-medium text-[#1a3c34]">
              Đã chọn <strong>{selectedIds.size}</strong> đơn
            </span>
            <Button
              size="sm"
              className="rounded-full bg-[#1a3c34] px-4 font-semibold text-white"
              onPress={() => setBulkModalOpen(true)}
              isDisabled={bulkMut.isPending}
            >
              Cập nhật trạng thái
            </Button>
            <button
              aria-label="Bỏ chọn tất cả"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-full p-1 text-foreground/50 hover:bg-black/5 hover:text-foreground/80"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <OrderTable
        items={items}
        isLoading={ordersQuery.isLoading}
        busyOrderId={busyOrderId}
        onViewDetail={(o) => router.push(ROUTES.orderDetail(o.id))}
        onViewInvoice={(o) => router.push(ROUTES.orderInvoice(o.id))}
        onAssignShipper={(o) => setAssignTarget(o)}
        onEdit={(o) => setEditTarget(o)}
        onDelete={confirmDelete}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-black/6 pt-4 sm:flex-row">
          <p className="text-xs text-foreground/50">
            Hiển thị{" "}
            {total === 0
              ? 0
              : (safePage - 1) * PAGE_SIZE + 1}
            -
            {Math.min(safePage * PAGE_SIZE, total)} / {total} đơn
          </p>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={safePage <= 1}
                  onPress={() => setPage((n) => Math.max(1, n - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === safePage}
                    onPress={() => setPage(n)}
                    className={
                      n === safePage
                        ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]"
                        : "min-w-9 rounded-full"
                    }
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={safePage >= totalPages}
                  onPress={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      ) : null}

      <NextLink
        href={ROUTES.ORDER_NEW}
        className="fixed bottom-8 right-8 z-20 flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-lg shadow-[#1a3c34]/30 transition hover:scale-[1.03] hover:bg-[#16352c]"
        aria-label="Tạo đơn mới"
      >
        <Plus className="size-7" />
      </NextLink>

      <AssignShipperModal
        order={assignTarget}
        isOpen={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
      />

      <OrderEditModal
        order={editTarget}
        isOpen={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />

      <BulkStatusModal
        count={selectedIds.size}
        isOpen={bulkModalOpen}
        isPending={bulkMut.isPending}
        onOpenChange={(open) => {
          if (!open) setBulkModalOpen(false);
        }}
        onConfirm={(status) => bulkMut.mutate({ status })}
      />
    </div>
  );
}
