"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Pagination,
  Select,
  Table,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import {
  categoryBadgeClass,
  effectiveDiscountPercent,
  formatVnd,
  getProductDisplayStatus,
  primaryProductImage,
} from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import { fetchAdminCategories } from "@/services/admin/categories-api";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminProduct,
  fetchAdminProducts,
} from "@/services/admin/products-api";
import {
  fetchShopSettings,
  updateShopSettings,
} from "@/services/admin/shop-settings-api";
import type { AdminProduct } from "@/services/admin/types";

import { GrabImportDialog } from "./GrabImportDialog";

const PAGE_SIZE = 12;
const CATEGORY_FILTER_ALL = "__all__";
type StatusFilter = "all" | "active" | "sold_out" | "disabled";

function statusLabel(s: ReturnType<typeof getProductDisplayStatus>): string {
  switch (s) {
    case "active":    return "Đang bán";
    case "sold_out":  return "Hết hàng";
    case "disabled":  return "Ngừng bán";
    default:          return "—";
  }
}

function statusPillClass(s: ReturnType<typeof getProductDisplayStatus>): string {
  switch (s) {
    case "active":    return "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
    case "sold_out":  return "bg-amber-50 text-amber-700 ring-amber-600/15";
    case "disabled":  return "bg-zinc-100 text-zinc-500 ring-black/8";
    default:          return "bg-zinc-100 text-zinc-400 ring-black/6";
  }
}

function usePaginationWindow(current: number, total: number, max = 5): number[] {
  return useMemo(() => {
    if (total <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, total, max]);
}

export function ProductsPageClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { confirm } = useAppDialog();

  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [globalDiscountInput, setGlobalDiscountInput] = useState("0");
  const [showSettings, setShowSettings] = useState(false);
  const [grabImportOpen, setGrabImportOpen] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipsFadeLeft, setChipsFadeLeft] = useState(false);
  const [chipsFadeRight, setChipsFadeRight] = useState(false);

  const syncChipsFade = () => {
    const el = chipsRef.current;
    if (!el) return;
    setChipsFadeLeft(el.scrollLeft > 1);
    setChipsFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;
    syncChipsFade();
    el.addEventListener("scroll", syncChipsFade, { passive: true });
    const ro = new ResizeObserver(syncChipsFade);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", syncChipsFade); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: shopSettings } = useQuery({
    queryKey: adminKeys.shopSettings,
    queryFn: fetchShopSettings,
  });

  useEffect(() => {
    if (shopSettings) setGlobalDiscountInput(String(shopSettings.globalDiscountPercent));
  }, [shopSettings]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  // Re-check arrow visibility when categories load/change
  useEffect(() => { syncChipsFade(); }, [categories]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: adminKeys.products({
      categoryId: categoryFilter || undefined,
      q: debouncedSearch || undefined,
    }),
    queryFn: () =>
      fetchAdminProducts({
        categoryId: categoryFilter || undefined,
        q: debouncedSearch || undefined,
      }),
  });

  // Status counts from all loaded products (pre-status-filter)
  const statusCounts = useMemo(() => {
    const active   = products.filter(p => getProductDisplayStatus(p) === "active").length;
    const sold_out = products.filter(p => getProductDisplayStatus(p) === "sold_out").length;
    const disabled = products.filter(p => getProductDisplayStatus(p) === "disabled").length;
    return { all: products.length, active, sold_out, disabled };
  }, [products]);

  const filtered = useMemo(() =>
    products.filter(p => statusFilter === "all" || getProductDisplayStatus(p) === statusFilter),
    [products, statusFilter],
  );

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const slice = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const pageWindow = usePaginationWindow(currentPage, pageCount, 5);

  useEffect(() => { setPage(1); }, [categoryFilter, statusFilter, debouncedSearch]);

  const deleteMut = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  const saveGlobalDiscountMut = useMutation({
    mutationFn: updateShopSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: adminKeys.shopSettings }),
  });

  const confirmDelete = async (p: AdminProduct) => {
    const ok = await confirm({
      title: "Xóa sản phẩm?",
      description: `Xóa "${p.name}"? Hành động không hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(p.id);
  };

  const globalPct = shopSettings?.globalDiscountPercent ?? 0;
  const hasActiveFilters = categoryFilter !== "" || statusFilter !== "all" || debouncedSearch !== "";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 pb-16">

      {/* ── Header ── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5a8f7a]">
            Quản lý kho
          </p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#1a1a1a]">
            Sản phẩm
          </h1>
          <p className="mt-1.5 text-sm text-foreground/50">
            Quản lý giá, biến thể, ảnh sản phẩm.{" "}
            <NextLink
              href={ROUTES.CATEGORIES}
              className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline"
            >
              Danh mục →
            </NextLink>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onPress={() => setGrabImportOpen(true)}
            className="h-9 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-foreground/70 transition hover:border-[#1a3c34]/25 hover:bg-[#f7faf9] hover:text-[#1a3c34]"
          >
            <UtensilsCrossed className="mr-1.5 size-3.5 text-[#5a8f7a]" />
            Import từ GrabFood
          </Button>
          <Button
            type="button"
            onPress={() => router.push(ROUTES.PRODUCT_NEW)}
            className="h-9 rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="mr-1.5 size-3.5" />
            Tạo sản phẩm
          </Button>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            {
              key: "all" as const,
              label: "Tổng sản phẩm",
              count: statusCounts.all,
              accent: "text-[#1a3c34]",
              bg: "bg-white",
              border: "border-black/8",
              active: statusFilter === "all",
            },
            {
              key: "active" as const,
              label: "Đang bán",
              count: statusCounts.active,
              accent: "text-emerald-700",
              bg: "bg-emerald-50/60",
              border: "border-emerald-600/12",
              active: statusFilter === "active",
            },
            {
              key: "sold_out" as const,
              label: "Hết hàng",
              count: statusCounts.sold_out,
              accent: "text-amber-700",
              bg: "bg-amber-50/70",
              border: "border-amber-600/12",
              active: statusFilter === "sold_out",
            },
            {
              key: "disabled" as const,
              label: "Ngừng bán",
              count: statusCounts.disabled,
              accent: "text-zinc-500",
              bg: "bg-[#fafafa]",
              border: "border-black/6",
              active: statusFilter === "disabled",
            },
          ] as const
        ).map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() =>
              setStatusFilter(stat.key === "all" ? "all" : stat.key)
            }
            className={`group relative flex flex-col gap-1 overflow-hidden rounded-2xl border p-4 text-left transition-all ${stat.bg} ${stat.border} ${stat.active ? "ring-2 ring-[#1a3c34]/20 shadow-sm" : "hover:shadow-sm hover:-translate-y-px"}`}
          >
            {stat.active && (
              <span className="absolute right-3 top-3 size-1.5 rounded-full bg-[#1a3c34]" />
            )}
            <span className={`text-2xl font-bold tabular-nums ${stat.accent}`}>
              {isLoading ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded-lg bg-black/8" />
              ) : (
                stat.count
              )}
            </span>
            <span className="text-[11px] font-semibold text-foreground/55">
              {stat.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Category chips ── */}
      <div className="relative">
        {/* Left fade + arrow */}
        {chipsFadeLeft && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f9fafb] to-transparent" />
            <button
              type="button"
              aria-label="Cuộn trái"
              onClick={() => chipsRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
              className="absolute left-0 top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.03]"
            >
              <ChevronLeft className="size-3.5 text-foreground/50" />
            </button>
          </>
        )}

        <div
          ref={chipsRef}
          className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max min-w-full items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                categoryFilter === ""
                  ? "border-[#1a3c34] bg-[#1a3c34] text-white shadow-sm"
                  : "border-black/10 bg-white text-foreground/65 hover:border-[#1a3c34]/30 hover:text-[#1a3c34]"
              }`}
            >
              Tất cả
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  categoryFilter === c.id
                    ? "border-[#1a3c34] bg-[#1a3c34] text-white shadow-sm"
                    : "border-black/10 bg-white text-foreground/65 hover:border-[#1a3c34]/30 hover:text-[#1a3c34]"
                }`}
              >
                {c.name}
                {c._count && (
                  <span className={`ml-1.5 rounded-full px-1 text-[10px] font-bold ${categoryFilter === c.id ? "bg-white/20 text-white" : "bg-black/6 text-foreground/45"}`}>
                    {c._count.products}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right fade + arrow */}
        {chipsFadeRight && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f9fafb] to-transparent" />
            <button
              type="button"
              aria-label="Cuộn phải"
              onClick={() => chipsRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
              className="absolute right-0 top-1/2 z-20 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.03]"
            >
              <ChevronRight className="size-3.5 text-foreground/50" />
            </button>
          </>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/35"
              aria-hidden
            />
            <Input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm theo tên, SKU, mô tả…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-full border border-black/10 bg-white pl-10 pr-4 text-sm shadow-sm ring-0 transition focus:border-[#1a3c34]/30 focus:shadow-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/60"
                aria-label="Xóa tìm kiếm"
              >
                <span className="text-xs">✕</span>
              </button>
            )}
          </div>

          {/* Status filter */}
          <Select
            className="w-36 shrink-0"
            placeholder="Trạng thái"
            value={statusFilter}
            onChange={(key) => { if (key != null) setStatusFilter(key as StatusFilter); }}
            variant="secondary"
          >
            <Select.Trigger className={`${adminSelectTriggerCompactClass} h-10 rounded-full border border-black/10 bg-white shadow-sm`}>
              <Select.Value className={adminSelectValueCompactClass} />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover placement="bottom end">
              <ListBox className="min-w-(--trigger-width) outline-none">
                {(["all", "active", "sold_out", "disabled"] as const).map((s) => (
                  <ListBox.Item key={s} id={s} textValue={{ all: "Tất cả", active: "Đang bán", sold_out: "Hết hàng", disabled: "Ngừng bán" }[s]} className="rounded-lg text-sm">
                    {{ all: "Tất cả", active: "Đang bán", sold_out: "Hết hàng", disabled: "Ngừng bán" }[s]}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {/* View toggle */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`rounded-full p-1.5 transition ${view === "grid" ? "bg-[#1a3c34] text-white shadow-sm" : "text-foreground/40 hover:text-foreground/70"}`}
              aria-label="Lưới"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full p-1.5 transition ${view === "list" ? "bg-[#1a3c34] text-white shadow-sm" : "text-foreground/40 hover:text-foreground/70"}`}
              aria-label="Danh sách"
            >
              <LayoutList className="size-3.5" />
            </button>
          </div>

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className={`shrink-0 rounded-full border p-2 shadow-sm transition ${showSettings ? "border-[#1a3c34]/30 bg-[#f7faf9] text-[#1a3c34]" : "border-black/10 bg-white text-foreground/45 hover:text-foreground/70"}`}
            aria-label="Cài đặt giảm giá"
            title="Cài đặt giảm giá toàn shop"
          >
            <Settings2 className="size-4" />
          </button>
        </div>

        {/* Inline settings panel */}
        {showSettings && (
          <Card className="rounded-2xl border border-[#1a3c34]/12 bg-[color-mix(in_oklab,#ecfdf5_40%,white)] shadow-sm">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#1a3c34]">
                  Giảm giá toàn bộ sản phẩm (%)
                </Label>
                <Description className="text-[11px] text-foreground/50">
                  Cộng thêm vào % giảm giá riêng từng sản phẩm. Tổng tối đa 100%.
                </Description>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={globalDiscountInput}
                  onChange={(e) => setGlobalDiscountInput(e.target.value)}
                  className="h-9 w-24 rounded-full border border-black/10 bg-white px-3 text-center text-sm font-semibold"
                  disabled={saveGlobalDiscountMut.isPending}
                  aria-label="Phần trăm giảm giá toàn shop"
                />
                <span className="text-sm text-foreground/50">%</span>
                <Button
                  className="h-9 rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white"
                  onPress={() => {
                    const n = Number.parseInt(globalDiscountInput, 10);
                    saveGlobalDiscountMut.mutate({
                      globalDiscountPercent: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0,
                    });
                  }}
                  isDisabled={saveGlobalDiscountMut.isPending}
                >
                  {saveGlobalDiscountMut.isPending ? "Đang lưu…" : "Lưu"}
                </Button>
              </div>
              {globalPct > 0 && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                  Đang giảm {globalPct}% toàn shop
                </span>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Products ── */}
      {isLoading ? (
        // Loading skeleton
        view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/6 bg-white">
                <div className="aspect-[4/3] animate-pulse bg-black/[0.06]" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded-lg bg-black/[0.06]" />
                  <div className="h-4 w-1/2 animate-pulse rounded-lg bg-black/[0.06]" />
                  <div className="h-5 w-1/3 animate-pulse rounded-lg bg-black/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-sm">
            <Table.Root className="min-w-[900px]" aria-hidden>
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    {["Sản phẩm", "Danh mục", "Giá", "Giảm giá", "Trạng thái", ""].map((col) => (
                      <Table.Column key={col} className="bg-[#fafafa] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/40" isRowHeader={col === "Sản phẩm"} textValue={col}>
                        {col}
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Table.Row key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <Table.Cell key={j} className="px-5 py-3.5">
                            <div className={`animate-pulse rounded-lg bg-black/[0.05] ${j === 0 ? "h-10" : "h-4"}`} style={{ width: j === 0 ? undefined : `${50 + (j * 13) % 40}%` }} />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table.Root>
          </Card>
        )
      ) : filtered.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#fafafa] py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#f0f6f4]">
            <Search className="size-6 text-[#5a8f7a]" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {hasActiveFilters ? "Không tìm thấy sản phẩm nào" : "Chưa có sản phẩm nào"}
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            {hasActiveFilters
              ? "Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm"
              : "Tạo sản phẩm đầu tiên hoặc import từ GrabFood"}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => { setCategoryFilter(""); setStatusFilter("all"); setSearch(""); }}
              className="mt-4 rounded-full bg-[#1a3c34] px-5 py-2 text-sm font-semibold text-white"
            >
              Xóa bộ lọc
            </button>
          ) : (
            <Button
              onPress={() => router.push(ROUTES.PRODUCT_NEW)}
              className="mt-4 rounded-full bg-[#1a3c34] px-5 text-sm font-semibold text-white"
            >
              <Plus className="mr-1.5 size-3.5" />
              Tạo sản phẩm mới
            </Button>
          )}
        </div>
      ) : view === "grid" ? (
        // ── Grid view ──
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {slice.map((p) => {
            const st = getProductDisplayStatus(p);
            const thumb = primaryProductImage(p);
            const eff = effectiveDiscountPercent(p, globalPct);
            return (
              <div
                key={p.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.14)]"
              >
                {/* Image area */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f5f5f5]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={p.name}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <span className="text-3xl opacity-20">🍵</span>
                    </div>
                  )}

                  {/* Dark overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Edit overlay CTA */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => router.push(ROUTES.productEdit(p.id))}
                      className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-[#1a3c34] shadow-md backdrop-blur-sm transition hover:bg-white"
                    >
                      Chỉnh sửa
                    </button>
                  </div>

                  {/* Status badge — top right */}
                  <span className={`absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${statusPillClass(st)}`}>
                    {statusLabel(st)}
                  </span>

                  {/* Discount badge — top left */}
                  {eff > 0 && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      −{eff}%
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-1 p-3.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1a1a1a]">
                    {p.name}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-bold tabular-nums text-[#1a3c34]">
                      {formatVnd(p.price)}
                    </span>
                    <Chip
                      size="sm"
                      variant="soft"
                      className={`border-0 text-[10px] font-bold uppercase tracking-wide ${categoryBadgeClass(p.category.slug)}`}
                    >
                      <Chip.Label>{p.category.name}</Chip.Label>
                    </Chip>
                  </div>
                  {p.sku && (
                    <p className="font-mono text-[10px] text-foreground/35">{p.sku}</p>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between border-t border-black/[0.05] px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.productEdit(p.id))}
                    className="flex items-center gap-1 text-xs font-semibold text-[#1a3c34] transition hover:underline"
                  >
                    <Pencil className="size-3" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDelete(p)}
                    disabled={deleteMut.isPending}
                    className="rounded p-1 text-foreground/30 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    aria-label="Xóa sản phẩm"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ── List / Table view ──
        <Card className="overflow-hidden rounded-2xl border border-black/[0.07] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)]">
          <Table.Root className="min-w-[880px]" aria-label="Danh sách sản phẩm">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  {[
                    { label: "Sản phẩm", cls: "w-[36%]", row: true },
                    { label: "Danh mục", cls: "w-[14%]" },
                    { label: "Giá", cls: "w-[12%]" },
                    { label: "Giảm giá", cls: "w-[12%]" },
                    { label: "Trạng thái", cls: "w-[14%]" },
                    { label: "", cls: "w-[12%] text-right" },
                  ].map((col) => (
                    <Table.Column
                      key={col.label}
                      isRowHeader={col.row}
                      className={`bg-[#fafafa] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/40 ${col.cls}`}
                      textValue={col.label}
                    >
                      {col.label}
                    </Table.Column>
                  ))}
                </Table.Header>
                <Table.Body>
                  {slice.map((p) => {
                    const st = getProductDisplayStatus(p);
                    const thumb = primaryProductImage(p);
                    const eff = effectiveDiscountPercent(p, globalPct);
                    return (
                      <Table.Row
                        key={p.id}
                        id={p.id}
                        className="group border-t border-black/[0.04] transition-colors hover:bg-[#1a3c34]/[0.018]"
                      >
                        {/* Product */}
                        <Table.Cell className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-3.5">
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f6] ring-1 ring-black/[0.06]">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="size-full object-cover" />
                              ) : (
                                <div className="flex size-full items-center justify-center text-base opacity-20">🍵</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => router.push(ROUTES.productEdit(p.id))}
                                className="line-clamp-1 text-left text-sm font-semibold text-foreground transition hover:text-[#1a3c34]"
                              >
                                {p.name}
                              </button>
                              {p.sku && (
                                <p className="font-mono text-[10px] text-foreground/35">{p.sku}</p>
                              )}
                            </div>
                          </div>
                        </Table.Cell>

                        {/* Category */}
                        <Table.Cell className="px-5 py-3.5 align-middle">
                          <Chip
                            size="sm"
                            variant="soft"
                            className={`border-0 text-[10px] font-bold uppercase tracking-wide ${categoryBadgeClass(p.category.slug)}`}
                          >
                            <Chip.Label>{p.category.name}</Chip.Label>
                          </Chip>
                        </Table.Cell>

                        {/* Price */}
                        <Table.Cell className="px-5 py-3.5 align-middle">
                          <span className="text-sm font-bold tabular-nums text-[#1a3c34]">
                            {formatVnd(p.price)}
                          </span>
                        </Table.Cell>

                        {/* Discount */}
                        <Table.Cell className="px-5 py-3.5 align-middle">
                          {eff > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-600/12">
                              −{eff}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-foreground/25">—</span>
                          )}
                        </Table.Cell>

                        {/* Status */}
                        <Table.Cell className="px-5 py-3.5 align-middle">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusPillClass(st)}`}>
                            {statusLabel(st)}
                          </span>
                        </Table.Cell>

                        {/* Actions */}
                        <Table.Cell className="px-5 py-3.5 text-right align-middle">
                          <div className="inline-flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Sửa"
                              onPress={() => router.push(ROUTES.productEdit(p.id))}
                              className="rounded-lg text-foreground/60 hover:bg-[#1a3c34]/8 hover:text-[#1a3c34]"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Xóa"
                              onPress={() => void confirmDelete(p)}
                              isDisabled={deleteMut.isPending}
                              className="rounded-lg text-foreground/40 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="size-3.5" />
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

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-black/[0.05] bg-[#fafafa] px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-foreground/45">
              {total === 0 ? "Không có kết quả" : (
                <>
                  Hiển thị{" "}
                  <strong className="text-foreground/70">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)}
                  </strong>
                  {" "}/ {total} sản phẩm
                </>
              )}
            </p>
            <Pagination.Root className="w-full justify-end sm:w-auto">
              <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
                <Pagination.Item>
                  <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((n) => Math.max(1, n - 1))}>
                    <Pagination.PreviousIcon />
                  </Pagination.Previous>
                </Pagination.Item>
                {pageWindow.map((n) => (
                  <Pagination.Item key={n}>
                    <Pagination.Link
                      isActive={n === currentPage}
                      onPress={() => setPage(n)}
                      className={n === currentPage ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]" : "min-w-9 rounded-full"}
                    >
                      {n}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                {pageWindow.length > 0 && pageWindow[pageWindow.length - 1]! < pageCount && (
                  <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
                )}
                <Pagination.Item>
                  <Pagination.Next isDisabled={currentPage >= pageCount} onPress={() => setPage((x) => Math.min(pageCount, x + 1))}>
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination.Root>
          </div>
        </Card>
      )}

      {/* Grid pagination (separate from table) */}
      {!isLoading && view === "grid" && filtered.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground/45">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} / {total} sản phẩm
          </p>
          <Pagination.Root className="w-auto">
            <Pagination.Content className="flex items-center gap-1">
              <Pagination.Item>
                <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((n) => Math.max(1, n - 1))}>
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === currentPage}
                    onPress={() => setPage(n)}
                    className={n === currentPage ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]" : "min-w-9 rounded-full"}
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              {pageWindow.length > 0 && pageWindow[pageWindow.length - 1]! < pageCount && (
                <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
              )}
              <Pagination.Item>
                <Pagination.Next isDisabled={currentPage >= pageCount} onPress={() => setPage((x) => Math.min(pageCount, x + 1))}>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      )}

      {/* GrabFood import dialog */}
      <GrabImportDialog
        isOpen={grabImportOpen}
        onOpenChange={setGrabImportOpen}
        categories={categories}
        onImported={() => void queryClient.invalidateQueries({ queryKey: ["admin", "products"] })}
      />
    </div>
  );
}
