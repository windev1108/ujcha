"use client";

import {
  Button,
  Card,
  CardContent,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Text,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Filter, MonitorSmartphone, Plus, QrCode, RefreshCw } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { tableAreaSelectOptions } from "@/lib/table-areas";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  deactivateAdminTable,
  deleteAdminTable,
  fetchAdminTables,
  fetchAdminTableStats,
  regenerateAdminTableQr,
} from "@/services/admin/tables-api";
import type { AdminTableRow } from "@/services/admin/types";

import { TableCard } from "./TableCard";
import { TableStats } from "./TableStats";

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

function groupByArea(tables: AdminTableRow[]): Map<string, AdminTableRow[]> {
  const m = new Map<string, AdminTableRow[]>();
  for (const t of tables) {
    const a = (t.area ?? "Tầng 1").trim() || "Tầng 1";
    if (!m.has(a)) m.set(a, []);
    m.get(a)!.push(t);
  }
  return m;
}

export function TablesPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [draftAreaFilter, setDraftAreaFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const filterModal = useOverlayState({
    isOpen: filterOpen,
    onOpenChange: setFilterOpen,
  });

  const tablesQuery = useQuery({
    queryKey: adminKeys.tables,
    queryFn: fetchAdminTables,
  });

  const statsQuery = useQuery({
    queryKey: adminKeys.tableStats,
    queryFn: fetchAdminTableStats,
  });

  const tables = tablesQuery.data ?? [];

  const uniqueAreas = useMemo(() => {
    const s = new Set<string>();
    for (const t of tables) {
      s.add((t.area ?? "Tầng 1").trim() || "Tầng 1");
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi"));
  }, [tables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      const area = (t.area ?? "Tầng 1").trim() || "Tầng 1";
      if (areaFilter && area !== areaFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.qrCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [tables, search, areaFilter]);

  const grouped = useMemo(() => groupByArea(filtered), [filtered]);

  const deleteMut = useMutation({
    mutationFn: deleteAdminTable,
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.tables });
      await queryClient.invalidateQueries({ queryKey: adminKeys.tableStats });
    },
    onError: async (e) => {
      const err = e as AxiosError<{ code?: string }>;
      if (err.response?.data?.code === "TABLE_HAS_ORDERS") {
        await showAlert(
          "Bàn đã có đơn hàng, không xóa được. Hãy vô hiệu hóa bàn thay thế.",
          "Không xóa được",
        );
      } else {
        await showAlert(axiosMessage(e), "Lỗi");
      }
    },
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateAdminTable,
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.tables });
      await queryClient.invalidateQueries({ queryKey: adminKeys.tableStats });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const regenMut = useMutation({
    mutationFn: regenerateAdminTableQr,
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.tables });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const openFilterModal = () => {
    setDraftAreaFilter(areaFilter);
    setFilterOpen(true);
  };

  const applyFilterModal = () => {
    setAreaFilter(draftAreaFilter);
    setFilterOpen(false);
  };

  const handleRefresh = () => {
    void tablesQuery.refetch();
    void statsQuery.refetch();
  };

  const confirmDelete = async (t: AdminTableRow) => {
    const ok = await confirm({
      title: "Xóa bàn?",
      description: `Xóa hẳn bàn “${t.name}”? Chỉ thực hiện được khi bàn chưa có đơn.`,
      tone: "danger",
      confirmLabel: "Xóa bàn",
    });
    if (ok) deleteMut.mutate(t.id);
  };

  const confirmDeactivate = async (t: AdminTableRow) => {
    const ok = await confirm({
      title: "Vô hiệu hóa bàn?",
      description: `Vô hiệu hóa bàn “${t.name}”? Bàn sẽ không còn dùng để đặt món.`,
      confirmLabel: "Vô hiệu hóa",
    });
    if (ok) deactivateMut.mutate(t.id);
  };

  return (
    <div className="relative flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Không gian
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Quản lý bàn
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Sơ đồ bàn theo khu vực, trạng thái phục vụ và mã QR cho khách quét gọi
            món.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full"
            onPress={handleRefresh}
            isDisabled={tablesQuery.isFetching || statsQuery.isFetching}
          >
            <RefreshCw className="mr-2 size-4" />
            Làm mới
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-black/15"
            onPress={openFilterModal}
          >
            <Filter className="mr-2 size-4" />
            Lọc sơ đồ
            {areaFilter ? (
              <span className="ml-1.5 rounded-full bg-[#1a3c34]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1a3c34]">
                1
              </span>
            ) : null}
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-[#1a3c34]/25 font-semibold text-[#1a3c34]"
            onPress={() => router.push(ROUTES.TABLE_COUNTER)}
          >
            <MonitorSmartphone className="mr-2 size-4" />
            Quầy QR
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
            onPress={() => router.push(ROUTES.TABLE_NEW)}
          >
            <Plus className="mr-2 size-4" />
            Thêm bàn mới
          </Button>
        </div>
      </header>

      <TableStats
        isLoading={statsQuery.isLoading}
        totalTables={statsQuery.data?.totalTables ?? 0}
        inUseCount={statsQuery.data?.inUseCount ?? 0}
        capacityPercent={statsQuery.data?.capacityPercent ?? 0}
        newTablesThisWeek={statsQuery.data?.newTablesThisWeek ?? 0}
        tableOrdersCount={statsQuery.data?.tableOrdersCount ?? 0}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className={`max-w-md flex-1 ${adminFieldStack}`}>
          <Label className={adminLabelClass}>
            Tìm kiếm
          </Label>
          {tablesQuery.isLoading ? (
            <div className="h-11 w-full animate-pulse rounded-xl bg-black/5" />
          ) : (
            <Input
              placeholder="Tên bàn, khu vực, hoặc URL QR…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm leading-none"
            />
          )}
        </div>
        <Text className="text-xs text-foreground/45">
          {tablesQuery.isLoading
            ? "…"
            : `${filtered.length} / ${tables.length} bàn hiển thị`}
        </Text>
      </div>

      {tablesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card
              key={i}
              className="rounded-2xl border border-black/6 bg-white/80"
            >
              <CardContent className="p-4">
                <div className="h-64 animate-pulse rounded-xl bg-black/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <Card className="rounded-2xl border border-black/6 bg-white">
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-foreground/60">
              Chưa có bàn nào hoặc không khớp bộ lọc.
            </p>
            <Button
              className="mt-4 rounded-full bg-[#1a3c34] font-semibold text-white"
              onPress={() => router.push(ROUTES.TABLE_NEW)}
            >
              <Plus className="mr-2 size-4" />
              Tạo bàn đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {Array.from(grouped.entries()).map(([area, rows]) => (
            <section key={area} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-[#1a3c34]">
                  Khu vực {area}
                </h2>
                <span className="text-xs font-medium text-foreground/45">
                  {rows.length} bàn tổng cộng
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((t) => (
                  <TableCard
                    key={t.id}
                    table={t}
                    busy={busyId === t.id}
                    onDelete={() => confirmDelete(t)}
                    onDeactivate={() => confirmDeactivate(t)}
                    onRegenerateQr={() => regenMut.mutate(t.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Card className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-[color-mix(in_oklab,#71b394_12%,white)] shadow-[0_8px_32px_-20px_rgba(26,60,52,0.2)]">
        <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative z-[1] max-w-xl space-y-1">
            <h3 className="text-base font-bold text-[#1a3c34]">
              Tối ưu quy trình gọi món
            </h3>
            <Description className="text-sm text-foreground/65">
              Khách quét QR tại bàn để xem menu và đặt món nhanh — giảm tải cho
              nhân viên phục vụ và đồng bộ với bếp theo thời gian thực.
            </Description>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                className="rounded-full bg-[#1a3c34] font-semibold text-white"
                onPress={() => router.push(ROUTES.TABLE_NEW)}
              >
                Hướng dẫn setup
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-[#1a3c34]/30"
                onPress={() => router.push(ROUTES.ORDERS)}
              >
                Xem báo cáo
              </Button>
            </div>
          </div>
          <div
            className="pointer-events-none absolute -right-4 -bottom-8 opacity-[0.12]"
            aria-hidden
          >
            <QrCode className="size-48 text-[#1a3c34]" strokeWidth={1} />
          </div>
        </CardContent>
      </Card>

      <NextLink
        href={ROUTES.TABLE_NEW}
        className="fixed bottom-8 right-8 z-20 flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-lg shadow-[#1a3c34]/30 transition hover:scale-[1.03] hover:bg-[#16352c]"
        aria-label="Thêm bàn mới"
      >
        <Plus className="size-7" />
      </NextLink>

      <Modal.Root state={filterModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              <Modal.Header className="border-b border-black/6 px-5 py-4">
                <Modal.Heading>Lọc theo khu vực</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 px-5 py-4">
                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>
                    Khu vực / tầng
                  </Label>
                  <Select
                    value={draftAreaFilter ? draftAreaFilter : "__kun_all__"}
                    onChange={(key) =>
                      setDraftAreaFilter(
                        key == null || String(key) === "__kun_all__"
                          ? ""
                          : String(key),
                      )
                    }
                  >
                    <Select.Trigger className={adminSelectTriggerClass}>
                      <Select.Value className={adminSelectValueClass} />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover placement="bottom start">
                      <ListBox className="max-h-56 min-w-(--trigger-width) outline-none">
                        <ListBox.Item
                          id="__kun_all__"
                          textValue="Tất cả khu vực"
                          className="rounded-lg text-sm"
                        >
                          Tất cả khu vực
                        </ListBox.Item>
                        {uniqueAreas.map((a) => (
                          <ListBox.Item
                            key={a}
                            id={a}
                            textValue={a}
                            className="rounded-lg text-sm"
                          >
                            {a}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
                <Button variant="ghost" onPress={() => setFilterOpen(false)}>
                  Hủy
                </Button>
                <Button
                  className="rounded-full bg-[#1a3c34] font-semibold text-white"
                  onPress={applyFilterModal}
                >
                  Áp dụng
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
