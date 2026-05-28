"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  Modal,
  Switch,
  Table,
  Text,
  useOverlayState,
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
import { sortOptionValues } from "@/lib/pos-line-price";
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from "@/services/admin/categories-api";
import {
  deleteAdminTopping,
  fetchAdminToppings,
} from "@/services/admin/toppings-api";
import {
  createVariantGroup,
  deleteVariantGroup,
  fetchVariantGroups,
  updateVariantGroup,
} from "@/services/admin/variant-groups-api";
import type {
  AdminCategory,
  AdminTopping,
  CreateVariantGroupBody,
  ProductOptionValue,
  VariantGroup,
} from "@/services/admin/types";
import { ToppingFormModal } from "@/app/toppings/components/ToppingFormModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const TOPPING_PAGE_SIZE = 10;
type ToppingFilter = "all" | "active" | "inactive";

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

type CatTab = "categories" | "variants" | "toppings";

// ─── Category modal ───────────────────────────────────────────────────────────

import Image from "next/image";

type CategoryFormData = { name: string; slug: string; sortOrder: string; thumbnail: string };

function CategoryModal({
  mode,
  initial,
  onSave,
  onClose,
  isPending,
}: {
  mode: "create" | "edit";
  initial?: AdminCategory;
  onSave: (d: CategoryFormData) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? "");
  const [thumbError, setThumbError] = useState(false);

  return (
    <>
      <Modal.Header className="border-b border-black/6 px-5 py-4">
        <Modal.Heading>
          {mode === "create" ? "Thêm danh mục" : "Sửa danh mục"}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Tên *
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Matcha Series"
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Slug (tuỳ chọn)
          </Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="matcha-series"
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Thứ tự
          </Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Thumbnail (URL ảnh)
          </Label>
          <Input
            value={thumbnail}
            onChange={(e) => { setThumbnail(e.target.value); setThumbError(false); }}
            placeholder="https://example.com/image.jpg"
            className="rounded-xl"
            disabled={isPending}
          />
          {thumbnail && !thumbError && (
            <div className="relative h-24 w-full overflow-hidden rounded-xl border border-black/6 bg-surface-card">
              <Image
                src={thumbnail}
                alt="preview"
                fill
                className="object-cover"
                sizes="400px"
                unoptimized
                onError={() => setThumbError(true)}
              />
            </div>
          )}
          {thumbnail && thumbError && (
            <p className="text-xs text-red-500">URL ảnh không hợp lệ hoặc không tải được.</p>
          )}
          <p className="text-[11px] text-foreground/40">
            Dán link ảnh từ bất kỳ dịch vụ hosting nào (Cloudinary, Imgur, …). Để trống để dùng màu gradient mặc định.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
        <Button variant="ghost" onPress={onClose} isDisabled={isPending}>
          Hủy
        </Button>
        <Button
          className="rounded-xl bg-[#1a3c34] font-semibold text-white"
          onPress={() => onSave({ name, slug, sortOrder, thumbnail })}
          isDisabled={isPending || !name.trim()}
        >
          {isPending ? "Đang lưu…" : mode === "create" ? "Thêm" : "Lưu"}
        </Button>
      </Modal.Footer>
    </>
  );
}

// ─── Variant group modal ──────────────────────────────────────────────────────

function VariantGroupModal({
  mode,
  initial,
  onSave,
  onClose,
  isPending,
}: {
  mode: "create" | "edit";
  initial?: VariantGroup;
  onSave: (body: CreateVariantGroupBody) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [values, setValues] = useState<ProductOptionValue[]>(
    initial?.values ?? [],
  );
  const [newLabel, setNewLabel] = useState("");
  const [newDelta, setNewDelta] = useState("0");

  const addValue = () => {
    const label = newLabel.trim();
    if (!label || values.some((v) => v.label === label)) return;
    const pd = Number.parseFloat(newDelta);
    setValues((prev) =>
      sortOptionValues([
        ...prev,
        { label, priceDelta: Number.isFinite(pd) && pd >= 0 ? pd : 0 },
      ]),
    );
    setNewLabel("");
    setNewDelta("0");
  };

  const removeValue = (label: string) =>
    setValues((prev) => prev.filter((v) => v.label !== label));

  return (
    <>
      <Modal.Header className="border-b border-black/6 px-5 py-4">
        <Modal.Heading>
          {mode === "create" ? "Thêm biến thể" : "Sửa biến thể"}
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Tên nhóm *
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Size, Đá, Độ ngọt"
            className="rounded-xl"
            disabled={isPending}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Thứ tự
            </Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-xl"
              disabled={isPending}
            />
          </div>
          <div className="flex items-end pb-0.5">
            <div className="flex items-center gap-2">
              <Switch
                isSelected={isActive}
                onChange={setIsActive}
                isDisabled={isPending}
                aria-label="Đang dùng"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
              <span className="text-sm">{isActive ? "Đang dùng" : "Tắt"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Giá trị
          </Label>
          {values.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {values.map((v) => (
                <li
                  key={v.label}
                  className="flex items-center gap-1 rounded-full bg-[#f3f4f6] px-3 py-1 text-sm ring-1 ring-black/8"
                >
                  <span>{v.label}</span>
                  {v.priceDelta > 0 && (
                    <span className="text-[10px] font-bold text-[#1a3c34]/60">
                      +{v.priceDelta.toLocaleString("vi")}đ
                    </span>
                  )}
                  <button
                    type="button"
                    className="ml-1 text-foreground/40 hover:text-red-600"
                    onClick={() => removeValue(v.label)}
                    disabled={isPending}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-foreground/45">Chưa có giá trị nào.</p>
          )}
          <div className="mt-1 flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addValue();
                }
              }}
              placeholder="Tên giá trị (vd. L, Ít đá)"
              className="flex-1 rounded-xl"
              disabled={isPending}
            />
            <Input
              type="number"
              min={0}
              step={500}
              value={newDelta}
              onChange={(e) => setNewDelta(e.target.value)}
              placeholder="+đ"
              className="w-24 rounded-xl"
              disabled={isPending}
            />
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 rounded-xl"
              onPress={addValue}
              isDisabled={!newLabel.trim() || isPending}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="text-[11px] text-foreground/40">
            Nhấn Enter hoặc &quot;+&quot; để thêm. Phụ phí để trống hoặc 0 nếu không thu thêm.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
        <Button variant="ghost" onPress={onClose} isDisabled={isPending}>
          Hủy
        </Button>
        <Button
          className="rounded-xl bg-[#1a3c34] font-semibold text-white"
          onPress={() =>
            onSave({
              name: name.trim(),
              values,
              sortOrder: Number.parseInt(sortOrder, 10) || 0,
              isActive,
            })
          }
          isDisabled={isPending || !name.trim()}
        >
          {isPending ? "Đang lưu…" : mode === "create" ? "Thêm" : "Lưu"}
        </Button>
      </Modal.Footer>
    </>
  );
}

// ─── Page client ──────────────────────────────────────────────────────────────

export function CategoriesPageClient() {
  const queryClient = useQueryClient();
  const { confirm, showAlert } = useAppDialog();
  const [tab, setTab] = useState<CatTab>("categories");

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  const { data: variantGroups = [], isLoading: vgLoading } = useQuery({
    queryKey: adminKeys.variantGroups,
    queryFn: fetchVariantGroups,
  });

  // ── Topping state ──
  const [toppingSearch, setToppingSearch] = useState("");
  const [debouncedToppingSearch, setDebouncedToppingSearch] = useState("");
  const [toppingFilter, setToppingFilter] = useState<ToppingFilter>("all");
  const [toppingPage, setToppingPage] = useState(1);
  const [toppingFormOpen, setToppingFormOpen] = useState(false);
  const [editTopping, setEditTopping] = useState<AdminTopping | null>(null);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedToppingSearch(toppingSearch),
      320,
    );
    return () => window.clearTimeout(t);
  }, [toppingSearch]);

  useEffect(() => {
    setToppingPage(1);
  }, [debouncedToppingSearch, toppingFilter]);

  const toppingsQuery = useQuery({
    queryKey: adminKeys.toppings,
    queryFn: () => fetchAdminToppings(),
  });
  const toppings: AdminTopping[] = toppingsQuery.data ?? [];

  const deleteToppingMut = useMutation({
    mutationFn: deleteAdminTopping,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.toppings }),
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const filteredToppings = useMemo(() => {
    const q = debouncedToppingSearch.trim().toLowerCase();
    return toppings.filter((t) => {
      if (toppingFilter === "active" && !t.isActive) return false;
      if (toppingFilter === "inactive" && t.isActive) return false;
      return !q || t.name.toLowerCase().includes(q);
    });
  }, [toppings, debouncedToppingSearch, toppingFilter]);

  const toppingTotal = filteredToppings.length;
  const toppingPageCount = Math.max(1, Math.ceil(toppingTotal / TOPPING_PAGE_SIZE));
  const toppingCurrentPage = Math.min(toppingPage, toppingPageCount);
  const toppingSlice = useMemo(() => {
    const start = (toppingCurrentPage - 1) * TOPPING_PAGE_SIZE;
    return filteredToppings.slice(start, start + TOPPING_PAGE_SIZE);
  }, [filteredToppings, toppingCurrentPage]);
  const toppingPageWindow = usePaginationWindow(toppingCurrentPage, toppingPageCount);

  // ── Category modal state ──
  const catModal = useOverlayState();
  const [editCat, setEditCat] = useState<AdminCategory | null>(null);

  const createCatMut = useMutation({
    mutationFn: (d: CategoryFormData) =>
      createAdminCategory({
        name: d.name.trim(),
        slug: d.slug.trim() || undefined,
        sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
        thumbnail: d.thumbnail.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      catModal.close();
    },
  });

  const updateCatMut = useMutation({
    mutationFn: (d: CategoryFormData) =>
      updateAdminCategory(editCat!.id, {
        name: d.name.trim(),
        slug: d.slug.trim() || undefined,
        sortOrder: Number.parseInt(d.sortOrder, 10) || 0,
        thumbnail: d.thumbnail.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      catModal.close();
      setEditCat(null);
    },
  });

  const deleteCatMut = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
  });

  // ── Variant group modal state ──
  const vgModal = useOverlayState();
  const [editVg, setEditVg] = useState<VariantGroup | null>(null);

  const createVgMut = useMutation({
    mutationFn: createVariantGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.variantGroups });
      vgModal.close();
    },
  });

  const updateVgMut = useMutation({
    mutationFn: (body: CreateVariantGroupBody) =>
      updateVariantGroup(editVg!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.variantGroups });
      vgModal.close();
      setEditVg(null);
    },
  });

  const deleteVgMut = useMutation({
    mutationFn: deleteVariantGroup,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.variantGroups }),
  });

  const catPending = createCatMut.isPending || updateCatMut.isPending;
  const vgPending = createVgMut.isPending || updateVgMut.isPending;

  const openCatCreate = () => {
    setEditCat(null);
    catModal.open();
  };
  const openCatEdit = (c: AdminCategory) => {
    setEditCat(c);
    catModal.open();
  };
  const closeCatModal = () => {
    catModal.close();
    setEditCat(null);
  };

  const openVgCreate = () => {
    setEditVg(null);
    vgModal.open();
  };
  const openVgEdit = (vg: VariantGroup) => {
    setEditVg(vg);
    vgModal.open();
  };
  const closeVgModal = () => {
    vgModal.close();
    setEditVg(null);
  };

  const openToppingCreate = () => {
    setEditTopping(null);
    setToppingFormOpen(true);
  };
  const openToppingEdit = (t: AdminTopping) => {
    setEditTopping(t);
    setToppingFormOpen(true);
  };

  const headerConfig = {
    categories: {
      title: "Danh mục sản phẩm",
      desc: "Tạo và sắp xếp danh mục dùng cho menu và form sản phẩm.",
      btnLabel: "Thêm danh mục",
      onAdd: openCatCreate,
    },
    variants: {
      title: "Biến thể",
      desc: "Quản lý nhóm biến thể (Size, Đá, Độ ngọt…) dùng chung khi tạo sản phẩm.",
      btnLabel: "Thêm biến thể",
      onAdd: openVgCreate,
    },
    toppings: {
      title: "Topping kèm món",
      desc: "Trân châu, kem muối, thạch… — giá cộng dồn khi nhân viên chọn trên màn hình đặt món.",
      btnLabel: "Thêm topping",
      onAdd: openToppingCreate,
    },
  } as const;

  const hc = headerConfig[tab];

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Phân loại
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            {hc.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">{hc.desc}</p>
        </div>
        <Button
          className="w-fit shrink-0 rounded-full bg-[#1a3c34] px-5 font-semibold text-white"
          onPress={hc.onAdd}
        >
          <Plus className="mr-2 size-4" />
          {hc.btnLabel}
        </Button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {(
          [
            ["categories", "Danh mục"],
            ["variants", "Biến thể"],
            ["toppings", "Topping"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              tab === id
                ? "bg-[#1a3c34] text-white"
                : "text-foreground/60 hover:bg-black/5 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Categories table ── */}
      {tab === "categories" && (
        <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="p-0">
            <Table.Root className="min-w-[720px]" aria-label="Danh mục">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column
                      isRowHeader
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                    >
                      Tên
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Ảnh
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Slug
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Thứ tự
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Số SP
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Thao tác
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {catsLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <Table.Row key={i}>
                            {Array.from({ length: 6 }).map((__, j) => (
                              <Table.Cell key={j} className="px-5 py-4">
                                <div className="h-4 animate-pulse rounded-md bg-black/5" />
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))
                      : categories.map((c) => (
                          <Table.Row key={c.id} id={c.id}>
                            <Table.Cell className="px-5 py-4 font-semibold text-foreground">
                              {c.name}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4">
                              {c.thumbnail ? (
                                <div className="relative size-10 overflow-hidden rounded-lg border border-black/6">
                                  <Image
                                    src={c.thumbnail}
                                    alt={c.name}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-foreground/30">—</span>
                              )}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 font-mono text-xs text-foreground/70">
                              {c.slug}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 tabular-nums">
                              {c.sortOrder}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 text-sm text-foreground/60">
                              {c._count?.products ?? 0}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 text-right">
                              <div className="inline-flex justify-end gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Sửa"
                                  onPress={() => openCatEdit(c)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  aria-label="Xóa"
                                  isDisabled={
                                    deleteCatMut.isPending ||
                                    (c._count?.products ?? 0) > 0
                                  }
                                  onPress={async () => {
                                    const ok = await confirm({
                                      title: "Xóa danh mục?",
                                      description: `Xóa danh mục "${c.name}"?`,
                                      tone: "danger",
                                      confirmLabel: "Xóa",
                                    });
                                    if (ok) deleteCatMut.mutate(c.id);
                                  }}
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
          </CardContent>
        </Card>
      )}

      {/* ── Variant groups table ── */}
      {tab === "variants" && (
        <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
          <CardContent className="p-0">
            <Table.Root className="min-w-[720px]" aria-label="Biến thể">
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column
                      isRowHeader
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                    >
                      Tên nhóm
                    </Table.Column>
                    <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                      Giá trị
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
                    {vgLoading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <Table.Row key={i}>
                            {Array.from({ length: 5 }).map((__, j) => (
                              <Table.Cell key={j} className="px-5 py-4">
                                <div className="h-4 animate-pulse rounded-md bg-black/5" />
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))
                      : variantGroups.map((vg) => (
                          <Table.Row key={vg.id} id={vg.id}>
                            <Table.Cell className="px-5 py-4 font-semibold text-foreground">
                              {vg.name}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4">
                              <div className="flex flex-wrap gap-1">
                                {vg.values.length === 0 ? (
                                  <span className="text-xs text-foreground/40">
                                    Chưa có giá trị
                                  </span>
                                ) : (
                                  vg.values.map((v) => (
                                    <span
                                      key={v.label}
                                      className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs ring-1 ring-black/8"
                                    >
                                      {v.label}
                                      {v.priceDelta > 0
                                        ? ` +${v.priceDelta.toLocaleString("vi")}đ`
                                        : ""}
                                    </span>
                                  ))
                                )}
                              </div>
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 tabular-nums">
                              {vg.sortOrder}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  vg.isActive
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-[#f3f4f6] text-foreground/50"
                                }`}
                              >
                                {vg.isActive ? "Đang dùng" : "Tắt"}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="px-5 py-4 text-right">
                              <div className="inline-flex justify-end gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Sửa"
                                  onPress={() => openVgEdit(vg)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  aria-label="Xóa"
                                  isDisabled={deleteVgMut.isPending}
                                  onPress={async () => {
                                    const ok = await confirm({
                                      title: "Xóa biến thể?",
                                      description: `Xóa nhóm biến thể "${vg.name}"?`,
                                      tone: "danger",
                                      confirmLabel: "Xóa",
                                    });
                                    if (ok) deleteVgMut.mutate(vg.id);
                                  }}
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
          </CardContent>
        </Card>
      )}

      {/* ── Toppings tab ── */}
      {tab === "toppings" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className={`max-w-md flex-1 ${adminFieldStack}`}>
              <Label className={adminLabelClass}>Tìm kiếm</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
                <Input
                  value={toppingSearch}
                  onChange={(e) => setToppingSearch(e.target.value)}
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
                  variant={toppingFilter === id ? "primary" : "ghost"}
                  className={
                    toppingFilter === id
                      ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                      : "rounded-full"
                  }
                  onPress={() => setToppingFilter(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="border-b border-black/6 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#1a3c34]">
                  Danh sách topping
                </p>
                <Text className="text-xs text-foreground/45">
                  {toppingTotal} mục
                  {toppingsQuery.isLoading ? " · Đang tải…" : ""}
                </Text>
              </div>
            </CardContent>
            <Table.Root
              className="min-w-[720px]"
              aria-label="Danh sách topping"
            >
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column
                      isRowHeader
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
                    {toppingsQuery.isLoading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <Table.Row key={i}>
                            {Array.from({ length: 5 }).map((__, j) => (
                              <Table.Cell key={j} className="px-5 py-4">
                                <div className="h-4 animate-pulse rounded-md bg-black/5" />
                              </Table.Cell>
                            ))}
                          </Table.Row>
                        ))
                      : toppingSlice.map((t) => (
                          <Table.Row key={t.id}>
                            <Table.Cell className="max-w-[280px] px-5 py-3">
                              <span className="font-medium text-[#1a3c34]">
                                {t.name}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="px-5 py-3 text-sm tabular-nums text-foreground/80">
                              {formatVnd(Number.parseFloat(t.price))}
                            </Table.Cell>
                            <Table.Cell className="px-5 py-3 text-sm tabular-nums text-foreground/70">
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
                                  onPress={() => openToppingEdit(t)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  aria-label="Xoá"
                                  isDisabled={deleteToppingMut.isPending}
                                  onPress={async () => {
                                    const ok = await confirm({
                                      title: "Xoá topping?",
                                      description: `"${t.name}" sẽ bị xoá vĩnh viễn.`,
                                      tone: "danger",
                                      confirmLabel: "Xoá",
                                    });
                                    if (ok) deleteToppingMut.mutate(t.id);
                                  }}
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
            {!toppingsQuery.isLoading && toppingSlice.length === 0 ? (
              <p className="p-8 text-center text-sm text-foreground/45">
                Không có topping nào — thêm mới hoặc đổi bộ lọc.
              </p>
            ) : null}
          </Card>

          {toppingPageCount > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                isDisabled={toppingCurrentPage <= 1}
                onPress={() => setToppingPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </Button>
              {toppingPageWindow.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={n === toppingCurrentPage ? "primary" : "ghost"}
                  className={
                    n === toppingCurrentPage
                      ? "min-w-9 rounded-full bg-[#1a3c34] text-white"
                      : "min-w-9 rounded-full"
                  }
                  onPress={() => setToppingPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                isDisabled={toppingCurrentPage >= toppingPageCount}
                onPress={() =>
                  setToppingPage((p) => Math.min(toppingPageCount, p + 1))
                }
              >
                Sau
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Category modal */}
      <Modal.Root
        state={catModal}
        onOpenChange={(open) => {
          if (!open) closeCatModal();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              <CategoryModal
                mode={editCat ? "edit" : "create"}
                initial={editCat ?? undefined}
                onSave={(d) =>
                  editCat ? updateCatMut.mutate(d) : createCatMut.mutate(d)
                }
                onClose={closeCatModal}
                isPending={catPending}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      {/* Variant group modal */}
      <Modal.Root
        state={vgModal}
        onOpenChange={(open) => {
          if (!open) closeVgModal();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" size="lg" scroll="inside">
            <Modal.Dialog className="max-w-lg rounded-2xl border border-black/6 p-0 shadow-xl">
              {vgModal.isOpen && (
                <VariantGroupModal
                  mode={editVg ? "edit" : "create"}
                  initial={editVg ?? undefined}
                  onSave={(body) =>
                    editVg ? updateVgMut.mutate(body) : createVgMut.mutate(body)
                  }
                  onClose={closeVgModal}
                  isPending={vgPending}
                />
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      {/* Topping form modal */}
      <ToppingFormModal
        topping={editTopping}
        isOpen={toppingFormOpen}
        onOpenChange={setToppingFormOpen}
      />
    </div>
  );
}
