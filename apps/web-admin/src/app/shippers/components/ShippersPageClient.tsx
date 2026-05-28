"use client";

import { Button, Card, CardContent, Input, Label, Text } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { BookOpen, Plus, Search, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { adminFieldStack, adminLabelClass } from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import {
  fetchAdminShipperStats,
  fetchAdminShippers,
  toggleAdminShipperAvailability,
} from "@/services/admin/shippers-api";
import type { AdminShipper } from "@/services/admin/types";

import { AddShipperFromStaffModal } from "./AddShipperFromStaffModal";
import { AssignOrdersModal } from "./AssignOrdersModal";
import { PendingDeliveryPanel } from "./PendingDeliveryPanel";
import { ShipperFormModal } from "./ShipperFormModal";
import { ShipperStats } from "./ShipperStats";
import { ShippersRegistryTable } from "./ShippersRegistryTable";

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

export function ShippersPageClient() {
  const qc = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  useOrderSocket();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [page, setPage] = useState(1);

  const [addFromStaffOpen, setAddFromStaffOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminShipper | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AdminShipper | null>(null);

  const [busyToggleId, setBusyToggleId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const shippersQuery = useQuery({
    queryKey: adminKeys.shippers,
    queryFn: () => fetchAdminShippers(),
  });

  const statsQuery = useQuery({
    queryKey: adminKeys.shipperStats,
    queryFn: fetchAdminShipperStats,
  });

  const shippers = shippersQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return shippers.filter((s) => {
      if (tab === "active" && !s.isActive) return false;
      if (tab === "inactive" && s.isActive) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [shippers, debouncedSearch, tab]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const slice = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageWindow = usePaginationWindow(currentPage, pageCount, 5);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab]);

  const toggleMut = useMutation({
    mutationFn: ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => toggleAdminShipperAvailability(id, isActive),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.shippers });
      await qc.invalidateQueries({ queryKey: adminKeys.shipperStats });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
    onSettled: () => setBusyToggleId(null),
  });

  const openCreate = () => setAddFromStaffOpen(true);

  const openEdit = (s: AdminShipper) => {
    setEditTarget(s);
    setFormOpen(true);
  };

  const openAssign = (s: AdminShipper) => {
    setAssignTarget(s);
    setAssignOpen(true);
  };

  const handleToggleActive = async (id: string, next: boolean) => {
    const row = shippers.find((s) => s.id === id);
    if (!next) {
      const ok = await confirm({
        title: "Tắt shipper?",
        description:
          `${row?.name ?? "Shipper"} sẽ không nhận đơn mới cho đến khi bật lại.`,
        tone: "danger",
        confirmLabel: "Tắt",
      });
      if (!ok) return;
    }
    setBusyToggleId(id);
    toggleMut.mutate({ id, isActive: next });
  };

  const stats = statsQuery.data;

  return (
    <div className="relative flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Vận hành giao hàng
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Quản lý shipper
          </h1>
          <p className="mt-2 max-w-xl text-sm text-foreground/60">
            Phân công đơn giao hàng, theo dõi trạng thái sẵn sàng và lịch sử giao.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full bg-[#1a3c34] px-5 font-semibold text-white shadow-md shadow-[#1a3c34]/25"
          onPress={openCreate}
        >
          <Plus className="mr-2 size-4" />
          Thêm shipper
        </Button>
      </header>

      <PendingDeliveryPanel />

      <ShipperStats
        isLoading={statsQuery.isLoading}
        totalActive={stats?.totalActive ?? 0}
        availableNow={stats?.availableNow ?? 0}
        avgDeliveryMinutes={stats?.avgDeliveryMinutes ?? null}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className={`max-w-md flex-1 ${adminFieldStack}`}>
          <Label className={adminLabelClass}>
            Tìm kiếm
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35"
              aria-hidden
            />
            <Input
              placeholder="Tên, SĐT hoặc ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border border-black/10 bg-white pl-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Tất cả"],
              ["active", "Đang bật"],
              ["inactive", "Đã tắt"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="ghost"
              className={
                tab === key
                  ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                  : "rounded-full border border-black/10"
              }
              onPress={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <ShippersRegistryTable
        shippers={slice}
        isLoading={shippersQuery.isLoading}
        busyToggleId={busyToggleId}
        onToggleActive={handleToggleActive}
        onAssign={openAssign}
        onEdit={openEdit}
      />

      {shippersQuery.isLoading ? null : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text className="text-sm text-foreground/55">
            Hiển thị{" "}
            <span className="font-semibold text-foreground">
              {slice.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
              {(currentPage - 1) * PAGE_SIZE + slice.length}
            </span>{" "}
            trong tổng{" "}
            <span className="font-semibold text-foreground">{total}</span> shipper
            {debouncedSearch.trim() || tab !== "all"
              ? " (đã lọc)"
              : ""}
          </Text>
          {pageCount > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                isDisabled={currentPage <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                ←
              </Button>
              {pageWindow.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant="ghost"
                  className={
                    n === currentPage
                      ? "min-w-9 rounded-full bg-[#1a3c34] font-semibold text-white"
                      : "min-w-9 rounded-full"
                  }
                  onPress={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                isDisabled={currentPage >= pageCount}
                onPress={() =>
                  setPage((p) => Math.min(pageCount, p + 1))
                }
              >
                →
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-0 bg-[#e8f5ef] shadow-sm lg:col-span-2">
          <CardContent className="relative flex flex-col gap-4 p-6">
            <div className="relative z-[1] max-w-lg space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3c34]/70">
                Tối ưu tuyến đường
              </p>
              <p className="text-lg font-semibold text-[#1a3c34]">
                Gom đơn theo khu vực để shipper xử lý nhanh hơn.
              </p>
              <p className="text-sm text-foreground/65">
                Xem đơn chưa gán trong modal &quot;Gán đơn&quot;, ưu tiên đơn cũ
                hơn trước khi phân công.
              </p>
              <Button
                variant="ghost"
                className="w-fit rounded-full border border-[#1a3c34]/25 bg-white/80 px-4 text-[#1a3c34]"
                onPress={() =>
                  void showAlert(
                    "Tài liệu vận hành đang được biên soạn.",
                    "Thông báo",
                  )
                }
              >
                <BookOpen className="mr-2 size-4" />
                Tài liệu (sắp có)
              </Button>
            </div>
            <TrendingUp
              className="pointer-events-none absolute -right-4 bottom-0 size-40 text-[#1a3c34]/10"
              aria-hidden
            />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 bg-[#d9f0e4] shadow-sm">
          <CardContent className="space-y-3 p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3c34]/70">
              Hiệu suất
            </p>
            <p className="text-sm font-semibold text-[#1a3c34]">
              Shipper sẵn sàng:{" "}
              <span className="tabular-nums">
                {stats?.availableNow ?? "—"}
              </span>
            </p>
            <p className="text-xs text-foreground/60">
              Số người đang bật và không có đơn delivery pending…ready.
            </p>
          </CardContent>
        </Card>
      </div>

      <AddShipperFromStaffModal
        isOpen={addFromStaffOpen}
        onOpenChange={setAddFromStaffOpen}
      />

      <ShipperFormModal
        shipper={editTarget}
        isOpen={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditTarget(null);
        }}
      />

      <AssignOrdersModal
        shipper={assignTarget}
        isOpen={assignOpen}
        onOpenChange={(o) => {
          setAssignOpen(o);
          if (!o) setAssignTarget(null);
        }}
      />
    </div>
  );
}
