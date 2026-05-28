"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  Table,
  Text,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminTopping,
  fetchAdminToppings,
} from "@/services/admin/toppings-api";
import type { AdminTopping } from "@/services/admin/types";

import { ToppingFormModal } from "./ToppingFormModal";

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

const PAGE_SIZE = 10;

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

export function ToppingsPageClient() {
  const qc = useQueryClient();
  const { confirm, showAlert } = useAppDialog();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTopping | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const listQuery = useQuery({
    queryKey: adminKeys.toppings,
    queryFn: () => fetchAdminToppings(),
  });

  const toppings = listQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return toppings.filter((t) => {
      if (tab === "active" && !t.isActive) return false;
      if (tab === "inactive" && t.isActive) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q);
    });
  }, [toppings, debouncedSearch, tab]);

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

  const deleteMut = useMutation({
    mutationFn: deleteAdminTopping,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.toppings });
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (t: AdminTopping) => {
    setEditTarget(t);
    setFormOpen(true);
  };

  const handleDelete = async (t: AdminTopping) => {
    const ok = await confirm({
      title: "Xoá topping?",
      description: `“${t.name}” sẽ bị xoá vĩnh viễn. Đơn cũ vẫn giữ snapshot nếu đã dùng.`,
      tone: "danger",
      confirmLabel: "Xoá",
    });
    if (!ok) return;
    deleteMut.mutate(t.id);
  };

  return (
    <div className="relative flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Thực đơn · POS
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Topping kèm món
          </h1>
          <p className="mt-2 max-w-xl text-sm text-foreground/60">
            Trân châu, kem muối, thạch… — giá cộng dồn khi nhân viên chọn trên
            màn hình đặt món.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full bg-[#1a3c34] px-5 font-semibold text-white shadow-md shadow-[#1a3c34]/25"
          onPress={openCreate}
        >
          <Plus className="mr-2 size-4" />
          Thêm topping
        </Button>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className={`max-w-md flex-1 ${adminFieldStack}`}>
          <Label className={adminLabelClass}>
            Tìm kiếm
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tên topping…"
              className={`${adminInputClass} bg-[#f9fafb] pl-10`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Tất cả"],
              ["active", "Đang bán"],
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
      </div>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <CardContent className="border-b border-black/6 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#1a3c34]">
              Danh sách topping
            </p>
            <Text className="text-xs text-foreground/45">
              {total} mục
              {listQuery.isLoading ? " · Đang tải…" : ""}
            </Text>
          </div>
        </CardContent>
        <Table.Root className="min-w-[720px]" aria-label="Danh sách topping">
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
                  Giá
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thứ tự
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
                        {Array.from({ length: 5 }).map((__, j) => (
                          <Table.Cell key={j} className="px-5 py-4">
                            <div className="h-4 animate-pulse rounded-md bg-black/5" />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  : slice.map((t) => (
                      <Table.Row key={t.id}>
                        <Table.Cell className="max-w-[280px] px-5 py-3">
                          <span className="font-medium text-[#1a3c34]">
                            {t.name}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm tabular-nums text-foreground/80">
                          {formatVnd(Number.parseFloat(t.price))}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 tabular-nums text-sm text-foreground/70">
                          {t.sortOrder}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          {t.isActive ? (
                            <Chip
                              size="sm"
                              variant="soft"
                              className="bg-emerald-500/15 text-emerald-800"
                            >
                              Đang bán
                            </Chip>
                          ) : (
                            <Chip
                              size="sm"
                              variant="soft"
                              className="bg-zinc-400/15 text-zinc-700"
                            >
                              Tắt
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-right">
                          <div className="inline-flex justify-end gap-1">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Sửa"
                              onPress={() => openEdit(t)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              aria-label="Xoá"
                              onPress={() => void handleDelete(t)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
        {!listQuery.isLoading && slice.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground/45">
            Không có topping nào — thêm mới hoặc đổi bộ lọc.
          </p>
        ) : null}
      </Card>

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={currentPage <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          {pageWindow.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === currentPage ? "primary" : "ghost"}
              className={
                n === currentPage
                  ? "min-w-9 rounded-full bg-[#1a3c34] text-white"
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
            isDisabled={currentPage >= pageCount}
            onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Sau
          </Button>
        </div>
      ) : null}

      <ToppingFormModal
        topping={editTarget}
        isOpen={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
