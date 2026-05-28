"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Description,
  Input,
  Label,
  Link,
  ListBox,
  Pagination,
  Select,
  Table,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileDown,
  FileSpreadsheet,
  Filter,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  categoryBadgeClass,
  effectiveDiscountPercent,
  formatVnd,
  getProductDisplayStatus,
  primaryProductImage,
} from "@/lib/product-display";
import {
  adminFieldStack,
  adminLabelClassProduct,
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminCategories } from "@/services/admin/categories-api";
import {
  deleteAdminProduct,
  fetchAdminProducts,
} from "@/services/admin/products-api";
import {
  fetchShopSettings,
  updateShopSettings,
} from "@/services/admin/shop-settings-api";
import type { AdminProduct } from "@/services/admin/types";

const PAGE_SIZE = 8;

/** Key trong Select cho lựa chọn “mọi danh mục” (không trùng uuid) */
const CATEGORY_FILTER_ALL = "__all__";

type StatusFilter = "all" | "active" | "sold_out" | "disabled";

function statusLabel(s: ReturnType<typeof getProductDisplayStatus>): string {
  switch (s) {
    case "active":
      return "Đang bán";
    case "sold_out":
      return "Hết hàng";
    case "disabled":
      return "Ngừng bán";
    default:
      return "—";
  }
}

function statusDotClass(s: ReturnType<typeof getProductDisplayStatus>): string {
  switch (s) {
    case "active":
      return "bg-emerald-500";
    case "sold_out":
      return "bg-amber-500";
    case "disabled":
      return "bg-zinc-400";
    default:
      return "bg-zinc-300";
  }
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
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

export function ProductsPageClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { confirm } = useAppDialog();

  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [globalDiscountInput, setGlobalDiscountInput] = useState("0");

  const { data: shopSettings } = useQuery({
    queryKey: adminKeys.shopSettings,
    queryFn: fetchShopSettings,
  });

  useEffect(() => {
    if (shopSettings) {
      setGlobalDiscountInput(String(shopSettings.globalDiscountPercent));
    }
  }, [shopSettings]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  const productQueryKey = adminKeys.products({
    categoryId: categoryFilter || undefined,
    q: debouncedSearch || undefined,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: productQueryKey,
    queryFn: () =>
      fetchAdminProducts({
        categoryId: categoryFilter || undefined,
        q: debouncedSearch || undefined,
      }),
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === "all") return true;
      return getProductDisplayStatus(p) === statusFilter;
    });
  }, [products, statusFilter]);

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
  }, [categoryFilter, statusFilter, debouncedSearch]);

  const deleteMut = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const saveGlobalDiscountMut = useMutation({
    mutationFn: updateShopSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.shopSettings });
    },
  });

  const confirmDelete = async (p: AdminProduct) => {
    const ok = await confirm({
      title: "Xóa sản phẩm?",
      description: `Xóa sản phẩm "${p.name}"? Hành động không hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(p.id);
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Quản lý kho
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Sản phẩm
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Quản lý giá, biến thể và ảnh (URL).{" "}
            <NextLink
              href={ROUTES.CATEGORIES}
              className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline"
            >
              Danh mục
            </NextLink>
          </p>
        </div>
        <Button
          type="button"
          onPress={() => router.push(ROUTES.PRODUCT_NEW)}
          className="shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
        >
          <Plus className="mr-2 size-4" />
          Tạo sản phẩm mới
        </Button>
      </header>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="relative w-full max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
              aria-hidden
            />
            <Input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm theo tên, SKU, mô tả…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-10 pr-4 text-sm ring-1 ring-black/6"
            />
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start">
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground/55 sm:mt-1">
                <Filter className="size-3.5" />
                Lọc
              </span>
              <div
                className={`min-w-[min(100%,180px)] max-w-full ${adminFieldStack}`}
              >
                <Label className={adminLabelClassProduct}>Danh mục</Label>
                <Select
                  className="w-full"
                  placeholder="Danh mục"
                  value={
                    categoryFilter === "" ? CATEGORY_FILTER_ALL : categoryFilter
                  }
                  onChange={(key) =>
                    setCategoryFilter(
                      key == null || key === CATEGORY_FILTER_ALL
                        ? ""
                        : String(key),
                    )
                  }
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerCompactClass}>
                    <Select.Value className={adminSelectValueCompactClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                      <ListBox.Item
                        id={CATEGORY_FILTER_ALL}
                        textValue="Tất cả danh mục"
                        className="rounded-lg text-sm"
                      >
                        Tất cả danh mục
                      </ListBox.Item>
                      {categories.map((c) => (
                        <ListBox.Item
                          key={c.id}
                          id={c.id}
                          textValue={c.name}
                          className="rounded-lg text-sm"
                        >
                          {c.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div
                className={`min-w-[min(100%,200px)] max-w-full ${adminFieldStack}`}
              >
                <Label className={adminLabelClassProduct}>
                  Trạng thái hiển thị
                </Label>
                <Select
                  className="w-full"
                  placeholder="Trạng thái"
                  value={statusFilter}
                  onChange={(key) => {
                    if (key != null)
                      setStatusFilter(key as StatusFilter);
                  }}
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerCompactClass}>
                    <Select.Value className={adminSelectValueCompactClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      <ListBox.Item
                        id="all"
                        textValue="Mọi trạng thái"
                        className="rounded-lg text-sm"
                      >
                        Mọi trạng thái
                      </ListBox.Item>
                      <ListBox.Item
                        id="active"
                        textValue="Đang bán"
                        className="rounded-lg text-sm"
                      >
                        Đang bán
                      </ListBox.Item>
                      <ListBox.Item
                        id="sold_out"
                        textValue="Hết hàng"
                        className="rounded-lg text-sm"
                      >
                        Hết hàng
                      </ListBox.Item>
                      <ListBox.Item
                        id="disabled"
                        textValue="Ngừng bán"
                        className="rounded-lg text-sm"
                      >
                        Ngừng bán
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-[#f3f4f6] p-1 ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded-full p-2 transition-colors ${view === "grid" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/45"}`}
                aria-label="Lưới"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-full p-2 transition-colors ${view === "list" ? "bg-white text-[#1a3c34] shadow-sm" : "text-foreground/45"}`}
                aria-label="Danh sách"
              >
                <LayoutList className="size-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-[#71b394]/25 bg-[color-mix(in_oklab,#ecfdf5_55%,white)]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className={`min-w-0 flex-1 ${adminFieldStack}`}>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[#1a3c34]">
              Giảm giá toàn bộ sản phẩm (%)
            </Label>
            <Description className="text-xs text-foreground/60">
              Áp dụng cộng với % giảm giá từng sản phẩm. Tổng giảm tối đa 100%.
            </Description>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={globalDiscountInput}
              onChange={(e) => setGlobalDiscountInput(e.target.value)}
              className="h-11 max-w-[200px] rounded-xl border border-black/10 bg-white"
              disabled={saveGlobalDiscountMut.isPending}
              aria-label="Phần trăm giảm giá toàn shop"
            />
          </div>
          <Button
            className="shrink-0 rounded-xl bg-[#1a3c34] font-semibold text-white"
            onPress={() => {
              const n = Number.parseInt(globalDiscountInput, 10);
              const v = Number.isFinite(n)
                ? Math.min(100, Math.max(0, n))
                : 0;
              saveGlobalDiscountMut.mutate({ globalDiscountPercent: v });
            }}
            isDisabled={saveGlobalDiscountMut.isPending}
          >
            {saveGlobalDiscountMut.isPending ? "Đang lưu…" : "Lưu giảm giá shop"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        view === "list" ? (
          <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
            <Table.Root className="min-w-[1020px]" aria-hidden>
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column
                      isRowHeader
                      textValue="Sản phẩm"
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                    >
                      Sản phẩm
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      SKU
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Danh mục
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Giá
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Giảm giá
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Trạng thái
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Thao tác
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Table.Row key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <Table.Cell key={j} className="px-5 py-4">
                            <div className="h-4 animate-pulse rounded-md bg-black/5" />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table.Root>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="overflow-hidden rounded-2xl border border-black/6"
              >
                <div className="aspect-[4/3] animate-pulse bg-black/5" />
                <CardContent className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-black/5" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-black/5" />
                  <div className="h-8 animate-pulse rounded-xl bg-black/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : view === "list" ? (
        <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
          <Table.Root className="min-w-[1020px]" aria-label="Danh sách sản phẩm">
            <Table.ScrollContainer>
              <Table.Content>
                <Table.Header>
                  <Table.Column
                    isRowHeader
                    className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                  >
                    Sản phẩm
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    SKU
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Danh mục
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Giá
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Giảm giá
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Trạng thái
                  </Table.Column>
                  <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Thao tác
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {slice.map((p) => {
                    const st = getProductDisplayStatus(p);
                    const thumb = primaryProductImage(p);
                    const globalPct = shopSettings?.globalDiscountPercent ?? 0;
                    const eff = effectiveDiscountPercent(p, globalPct);
                    return (
                      <Table.Row key={p.id} id={p.id}>
                        <Table.Cell className="px-5 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f6] ring-1 ring-black/6">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={thumb}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-[9px] text-foreground/35">
                                  —
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {p.name}
                              </p>
                              <p className="line-clamp-1 text-xs text-foreground/50">
                                {p.description || "—"}
                              </p>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 align-middle font-mono text-xs text-foreground/80">
                          {p.sku ?? "—"}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 align-middle">
                          <Chip
                            size="sm"
                            variant="soft"
                            className={`border-0 font-bold uppercase tracking-wide ${categoryBadgeClass(p.category.slug)}`}
                          >
                            <Chip.Label>{p.category.name}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 align-middle font-medium tabular-nums">
                          {formatVnd(p.price)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 align-middle text-xs">
                          {eff > 0 ? (
                            <span className="font-semibold text-[#b45309]">
                              −{eff}%
                              {globalPct > 0 && (p.discountPercent ?? 0) > 0 ? (
                                <span className="ml-1 font-normal text-foreground/45">
                                  (SP {(p.discountPercent ?? 0)}% + shop{" "}
                                  {globalPct}%)
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-foreground/35">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 align-middle">
                          <span className="inline-flex items-center gap-2 text-xs font-medium">
                            <span
                              className={`size-2 shrink-0 rounded-full ${statusDotClass(st)}`}
                            />
                            {statusLabel(st)}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-4 text-right align-middle">
                          <div className="inline-flex justify-end gap-1">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="Sửa"
                              onPress={() =>
                                router.push(ROUTES.productEdit(p.id))
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                              aria-label="Xóa"
                              onPress={() => confirmDelete(p)}
                              isDisabled={deleteMut.isPending}
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

          <div className="flex flex-col items-center justify-between gap-3 border-t border-black/6 px-5 py-4 sm:flex-row">
            <p className="text-xs text-foreground/50">
              Hiển thị{" "}
              {total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, total)} / {total} sản phẩm
            </p>

            <Pagination.Root className="w-full justify-end sm:w-auto">
              <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
                <Pagination.Item>
                  <Pagination.Previous
                    isDisabled={currentPage <= 1}
                    onPress={() => setPage((n) => Math.max(1, n - 1))}
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
                          ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]"
                          : "min-w-9 rounded-full"
                      }
                    >
                      {n}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                {pageWindow.length > 0 &&
                  pageWindow[pageWindow.length - 1]! < pageCount ? (
                  <Pagination.Item>
                    <Pagination.Ellipsis />
                  </Pagination.Item>
                ) : null}
                <Pagination.Item>
                  <Pagination.Next
                    isDisabled={currentPage >= pageCount}
                    onPress={() =>
                      setPage((x) => Math.min(pageCount, x + 1))
                    }
                  >
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination.Root>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slice.map((p) => {
            const st = getProductDisplayStatus(p);
            const thumb = primaryProductImage(p);
            const globalPctGrid = shopSettings?.globalDiscountPercent ?? 0;
            const effGrid = effectiveDiscountPercent(p, globalPctGrid);
            return (
              <Card
                key={p.id}
                className="rounded-2xl border border-black/6 shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f6]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">{p.name}</p>
                      <p className="mt-1 text-xs text-foreground/50">
                        {p.sku ?? "—"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#1a3c34]">
                        {formatVnd(p.price)}
                      </p>
                      {effGrid > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-[#b45309]">
                          Giảm −{effGrid}%
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                      <span
                        className={`size-1.5 rounded-full ${statusDotClass(st)}`}
                      />
                      {statusLabel(st)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          router.push(ROUTES.productEdit(p.id))
                        }
                      >
                        Sửa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-2xl border border-emerald-100 bg-[color-mix(in_oklab,#ecfdf5_80%,white)]">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
                Growth insight
              </p>
              <p className="mt-2 text-lg font-bold text-[#14532d]">
                Doanh số matcha tăng 24% trong mùa ritual năm nay.
              </p>
              <p className="mt-1 text-sm text-foreground/55">
                Theo dõi xu hướng và tối ưu tồn kho theo từng danh mục.
              </p>
              <Link
                href="/"
                className="mt-3 inline-flex text-sm font-semibold text-[#1a3c34] underline-offset-4 hover:underline"
              >
                Xem báo cáo analytics →
              </Link>
            </div>
            <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-black/6 sm:block" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-black/6 bg-[#fafafa]">
          <CardContent className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">
              Quick export
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              Dữ liệu kho
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                className="flex-1 justify-center gap-2 rounded-xl border border-black/8 bg-white"
                isDisabled
              >
                <FileDown className="size-4" />
                Export PDF
              </Button>
              <Button
                variant="ghost"
                className="flex-1 justify-center gap-2 rounded-xl border border-black/8 bg-white"
                isDisabled
              >
                <FileSpreadsheet className="size-4" />
                CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
