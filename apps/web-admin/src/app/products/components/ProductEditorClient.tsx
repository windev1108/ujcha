"use client";

import {
  Button,
  Card,
  CardContent,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextArea,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  adminFieldStack,
  adminInputClass,
  adminLabelClassProduct,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { computeAdminFinalPrice, formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminCategories } from "@/services/admin/categories-api";
import {
  createAdminProduct,
  fetchAdminProduct,
  updateAdminProduct,
} from "@/services/admin/products-api";
import type { AdminProduct, ProductOptionGroup, ProductTopping } from "@/services/admin/types";

function parseApiMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: unknown } } })
      .response?.data;
    const m = data?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Không lưu được.";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function serializeProductFormSnapshot(input: {
  sku: string;
  name: string;
  categoryId: string;
  price: string;
  discountPercent: string;
  description: string;
  imageUrls: string[];
  optionGroups: ProductOptionGroup[];
  toppings: ProductTopping[];
  isAvailable: boolean;
  isSoldOut: boolean;
  isBestSeller: boolean;
}): string {
  const urls = input.imageUrls.map((u) => u.trim()).filter(Boolean);
  const p = Number.parseFloat(input.price);
  const priceRounded = Number.isFinite(p) ? Math.round(p) : 0;
  const disc = Number.parseInt(input.discountPercent, 10);
  const discountRounded = Number.isFinite(disc)
    ? Math.min(100, Math.max(0, disc))
    : 0;
  return JSON.stringify({
    sku: input.sku.trim(),
    name: input.name.trim(),
    categoryId: input.categoryId,
    price: priceRounded,
    discountPercent: discountRounded,
    description: input.description.trim(),
    imageUrls: urls,
    optionGroups: input.optionGroups,
    toppings: input.toppings,
    isAvailable: input.isAvailable,
    isSoldOut: input.isSoldOut,
    isBestSeller: input.isBestSeller,
  });
}

function snapshotFromAdminProduct(existing: AdminProduct): string {
  const imgs = asStringArray(existing.imageUrls);
  return serializeProductFormSnapshot({
    sku: existing.sku ?? "",
    name: existing.name,
    categoryId: existing.categoryId,
    price: String(Math.round(Number.parseFloat(existing.price) || 0)),
    discountPercent: String(existing.discountPercent ?? 0),
    description: existing.description ?? "",
    imageUrls: imgs.length ? imgs : [""],
    optionGroups: existing.optionGroups ?? [],
    toppings: existing.toppings ?? [],
    isAvailable: existing.isAvailable,
    isSoldOut: existing.isSoldOut ?? false,
    isBestSeller: existing.isBestSeller ?? false,
  });
}

type Props = { mode: "create" | "edit"; productId?: string };

export function ProductEditorClient({ mode, productId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  const { data: existing, isLoading: loadingProduct } = useQuery({
    queryKey: productId
      ? adminKeys.product(productId)
      : ["admin", "products", "none"],
    queryFn: () => fetchAdminProduct(productId!),
    enabled: mode === "edit" && !!productId,
  });

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("0");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([""]);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);
  const [toppings, setToppings] = useState<ProductTopping[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const createBaselineReadyRef = useRef(false);

  useEffect(() => {
    if (mode === "edit" && existing) {
      createBaselineReadyRef.current = false;
      setSku(existing.sku ?? "");
      setName(existing.name);
      setCategoryId(existing.categoryId);
      setPrice(String(Math.round(Number.parseFloat(existing.price) || 0)));
      setDiscountPercent(String(existing.discountPercent ?? 0));
      setDescription(existing.description ?? "");
      const imgs = asStringArray(existing.imageUrls);
      setImageUrls(imgs.length ? imgs : [""]);
      setOptionGroups(existing.optionGroups ?? []);
      setToppings(existing.toppings ?? []);
      setIsAvailable(existing.isAvailable);
      setIsSoldOut(existing.isSoldOut ?? false);
      setIsBestSeller(existing.isBestSeller ?? false);
      setBaselineSnapshot(snapshotFromAdminProduct(existing));
    } else if (mode === "create" && categories.length) {
      setCategoryId((id) => id || categories[0]!.id);
      if (!createBaselineReadyRef.current) {
        createBaselineReadyRef.current = true;
        setBaselineSnapshot(
          serializeProductFormSnapshot({
            sku: "",
            name: "",
            categoryId: categories[0]!.id,
            price: "0",
            discountPercent: "0",
            description: "",
            imageUrls: [""],
            optionGroups: [],
            toppings: [],
            isAvailable: true,
            isSoldOut: false,
            isBestSeller: false,
          }),
        );
      }
    }
  }, [mode, existing, categories]);

  const title =
    mode === "create" ? "Thêm Sản Phẩm Mới" : "Chỉnh sửa sản phẩm";

  const saveMut = useMutation({
    mutationFn: async () => {
      const urls = imageUrls.map((u) => u.trim()).filter(Boolean);
      const p = Number.parseFloat(price);
      if (!Number.isFinite(p) || p < 0) throw new Error("INVALID_PRICE");
      if (!name.trim() || !categoryId) throw new Error("REQUIRED");
      const discRaw = Number.parseInt(discountPercent, 10);
      const disc = Number.isFinite(discRaw)
        ? Math.min(100, Math.max(0, discRaw))
        : 0;
      const base = {
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: p,
        discountPercent: disc,
        imageUrls: urls,
        optionGroups: optionGroups.length > 0 ? optionGroups : undefined,
        toppings: toppings.length > 0 ? toppings : undefined,
        isAvailable,
        isSoldOut,
        isBestSeller,
      };
      const skuTrim = sku.trim();
      if (mode === "create") {
        return createAdminProduct({
          ...base,
          ...(skuTrim ? { sku: skuTrim } : {}),
        });
      }
      return updateAdminProduct(productId!, {
        ...base,
        sku: skuTrim || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push(ROUTES.PRODUCTS);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : parseApiMessage(e);
      if (msg === "INVALID_PRICE") setError("Giá không hợp lệ.");
      else if (msg === "REQUIRED") setError("Tên và danh mục là bắt buộc.");
      else setError(parseApiMessage(e));
    },
  });

  const pending = saveMut.isPending;

  const currentSnapshot = useMemo(
    () =>
      serializeProductFormSnapshot({
        sku,
        name,
        categoryId,
        price,
        discountPercent,
        description,
        imageUrls,
        optionGroups,
        toppings,
        isAvailable,
        isSoldOut,
        isBestSeller,
      }),
    [
      sku,
      name,
      categoryId,
      price,
      discountPercent,
      description,
      imageUrls,
      optionGroups,
      toppings,
      isAvailable,
      isSoldOut,
      isBestSeller,
    ],
  );

  const isDirty =
    baselineSnapshot !== null && currentSnapshot !== baselineSnapshot;

  const addImageRow = () => setImageUrls((prev) => [...prev, ""]);
  const setImageAt = (i: number, v: string) =>
    setImageUrls((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  const removeImageRow = (i: number) =>
    setImageUrls((prev) =>
      prev.length <= 1 ? [""] : prev.filter((_, j) => j !== i),
    );

  const previews = useMemo(
    () => imageUrls.map((u) => u.trim()).filter(Boolean),
    [imageUrls],
  );

  const priceRange = useMemo(() => {
    const base = Number.parseFloat(price);
    if (!Number.isFinite(base) || base <= 0) return null;
    if (!optionGroups.length) return null;
    let minExtra = 0;
    let maxExtra = 0;
    for (const og of optionGroups) {
      if (!og.values.length) continue;
      const deltas = og.values.map((v) =>
        Number.isFinite(v.priceDelta) ? v.priceDelta : 0,
      );
      minExtra += Math.min(...deltas);
      maxExtra += Math.max(...deltas);
    }
    if (maxExtra === 0) return null;
    return { min: base + minExtra, max: base + maxExtra };
  }, [price, optionGroups]);

  // ── Option Groups helpers ──────────────────────────────────────────────────

  const addOptionGroup = () =>
    setOptionGroups((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", selectionMin: 1, selectionMax: 1, values: [{ label: "", priceDelta: 0 }] },
    ]);

  const removeOptionGroup = (idx: number) =>
    setOptionGroups((prev) => prev.filter((_, i) => i !== idx));

  const updateOptionGroup = (idx: number, patch: Partial<ProductOptionGroup>) =>
    setOptionGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    );

  const addOptionValue = (gIdx: number) =>
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? { ...g, values: [...g.values, { label: "", priceDelta: 0 }] }
          : g,
      ),
    );

  const removeOptionValue = (gIdx: number, vIdx: number) =>
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? { ...g, values: g.values.length <= 1 ? g.values : g.values.filter((_, j) => j !== vIdx) }
          : g,
      ),
    );

  const updateOptionValue = (gIdx: number, vIdx: number, patch: Partial<{ label: string; priceDelta: number }>) =>
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? { ...g, values: g.values.map((v, j) => (j === vIdx ? { ...v, ...patch } : v)) }
          : g,
      ),
    );

  // ── Toppings helpers ──────────────────────────────────────────────────────

  const addTopping = () =>
    setToppings((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", price: 0, isActive: true },
    ]);

  const removeTopping = (idx: number) =>
    setToppings((prev) => prev.filter((_, i) => i !== idx));

  const updateTopping = (idx: number, patch: Partial<ProductTopping>) =>
    setToppings((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );

  if (mode === "edit" && loadingProduct) {
    return (
      <div className="flex flex-col gap-6 pb-16">
        <div className="h-9 w-40 animate-pulse rounded-full bg-black/5" />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            <div className="h-72 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-48 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-36 animate-pulse rounded-2xl bg-black/5" />
          </div>
          <div className="flex flex-col gap-6">
            <div className="h-64 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-40 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-48 animate-pulse rounded-2xl bg-black/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => router.push(ROUTES.PRODUCTS)}
            className="group -ml-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-foreground/55 transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Sản phẩm
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a3c34]">
            {title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && !pending && (
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/80 sm:inline-flex">
              Chưa lưu
            </span>
          )}
          <Button
            variant="ghost"
            className="rounded-full"
            onPress={() => router.push(ROUTES.PRODUCTS)}
          >
            Hủy
          </Button>
          <Button
            className={`rounded-full font-semibold text-white transition-all ${
              isDirty && !pending
                ? "bg-[#1a3c34] shadow-[0_0_0_3px_rgba(26,60,52,0.15)]"
                : "bg-[#1a3c34]"
            }`}
            onPress={() => {
              setError(null);
              saveMut.mutate();
            }}
            isDisabled={pending || !isDirty}
          >
            <Save className="mr-2 size-4" />
            {pending ? "Đang lưu…" : isDirty ? "Lưu thay đổi" : "Lưu"}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                Thông tin cơ bản
              </h2>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>
                  Tên sản phẩm *
                </Label>
                <Input
                  fullWidth
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Matcha Latte Cốt Dừa"
                  className={`w-full ${adminInputClass}`}
                  disabled={pending}
                />
              </div>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>Danh mục *</Label>
                <Select
                  className="w-full"
                  placeholder="— Chọn danh mục —"
                  value={categoryId ? categoryId : null}
                  onChange={(key) =>
                    setCategoryId(key == null ? "" : String(key))
                  }
                  isDisabled={pending || categories.length === 0}
                  fullWidth
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerClass}>
                    <Select.Value className={adminSelectValueClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="max-h-60 overflow-y-auto outline-none">
                      {categories.map((c) => (
                        <ListBox.Item
                          key={c.id}
                          id={c.id}
                          textValue={c.name}
                          className="rounded-lg"
                        >
                          {c.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {categories.length === 0 ? (
                  <Description className="text-xs text-amber-800">
                    Chưa có danh mục — hãy tạo danh mục trước khi thêm sản
                    phẩm.
                  </Description>
                ) : null}
              </div>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>
                  Giá bán (VNĐ) *
                </Label>
                <Input
                  fullWidth
                  type="number"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`w-full ${adminInputClass}`}
                  disabled={pending}
                />
                {priceRange ? (
                  <Description className="text-xs text-foreground/50">
                    Giá hiển thị: từ{" "}
                    <span className="font-semibold tabular-nums">
                      {formatVnd(priceRange.min)}
                    </span>{" "}
                    đến{" "}
                    <span className="font-semibold tabular-nums">
                      {formatVnd(priceRange.max)}
                    </span>{" "}
                    tuỳ biến thể đã chọn.
                  </Description>
                ) : null}
              </div>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>
                  Giảm giá sản phẩm (%)
                </Label>
                <Input
                  fullWidth
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className={`w-full ${adminInputClass}`}
                  disabled={pending}
                />
                {(() => {
                  const disc = Number.parseInt(discountPercent, 10);
                  const productDisc = Number.isFinite(disc) ? Math.min(100, Math.max(0, disc)) : 0;
                  const globalDisc = existing?.globalDiscountPercent ?? 0;
                  // Product-specific wins if set; global is fallback
                  const effective = productDisc > 0 ? productDisc : globalDisc;
                  const basePrice = Number.parseFloat(price);
                  const hasPrice = Number.isFinite(basePrice) && basePrice > 0;
                  return (
                    <Description className="text-xs text-foreground/50">
                      {hasPrice && effective > 0 ? (
                        <>
                          Giá sau giảm:{" "}
                          <span className="font-semibold tabular-nums text-[#1a3c34]">
                            {formatVnd(computeAdminFinalPrice(basePrice, effective))}
                          </span>
                          {globalDisc > 0 && productDisc === 0 && (
                            <span className="ml-1">(dùng giảm toàn shop {globalDisc}%)</span>
                          )}
                          {globalDisc > 0 && productDisc > 0 && (
                            <span className="ml-1">(giảm riêng {productDisc}% — ghi đè toàn shop {globalDisc}%)</span>
                          )}
                          .{" "}
                        </>
                      ) : null}
                      {globalDisc > 0
                        ? `Toàn shop đang giảm ${globalDisc}%. Đặt giảm riêng ở đây sẽ ghi đè mức toàn shop cho sản phẩm này.`
                        : "0–100%. Để trống (0) sẽ dùng giảm giá toàn shop nếu có."}
                    </Description>
                  );
                })()}
              </div>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>Mô tả sản phẩm</Label>
                <TextArea
                  fullWidth
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập câu chuyện về sản phẩm này…"
                  className="min-h-[140px] w-full rounded-xl"
                  disabled={pending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Option Groups inline editor */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                  Nhóm tùy chọn
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onPress={addOptionGroup}
                  isDisabled={pending}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Thêm nhóm
                </Button>
              </div>
              <p className="text-xs text-foreground/50">
                Ví dụ: Size, Độ đá, Độ ngọt — khách phải chọn (selectionMin ≥ 1).
              </p>
              {optionGroups.length === 0 ? (
                <p className="text-sm text-foreground/40">Chưa có nhóm tùy chọn.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {optionGroups.map((og, gIdx) => (
                    <div key={og.id} className="rounded-xl border border-black/8 p-4">
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                          <div className={adminFieldStack}>
                            <Label className={adminLabelClassProduct}>Tên nhóm</Label>
                            <Input
                              fullWidth
                              value={og.name}
                              onChange={(e) => updateOptionGroup(gIdx, { name: e.target.value })}
                              placeholder="Ví dụ: Size"
                              className={`w-full ${adminInputClass}`}
                              disabled={pending}
                            />
                          </div>
                          <div className="flex gap-3">
                            <div className={`flex-1 ${adminFieldStack}`}>
                              <Label className={adminLabelClassProduct}>Chọn tối thiểu</Label>
                              <Input
                                fullWidth
                                type="number"
                                min={0}
                                step={1}
                                value={String(og.selectionMin)}
                                onChange={(e) => updateOptionGroup(gIdx, { selectionMin: Number(e.target.value) || 0 })}
                                className={`w-full ${adminInputClass}`}
                                disabled={pending}
                              />
                            </div>
                            <div className={`flex-1 ${adminFieldStack}`}>
                              <Label className={adminLabelClassProduct}>Chọn tối đa</Label>
                              <Input
                                fullWidth
                                type="number"
                                min={1}
                                step={1}
                                value={String(og.selectionMax)}
                                onChange={(e) => updateOptionGroup(gIdx, { selectionMax: Number(e.target.value) || 1 })}
                                className={`w-full ${adminInputClass}`}
                                disabled={pending}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className={adminLabelClassProduct}>Giá trị</Label>
                            {og.values.map((val, vIdx) => (
                              <div key={vIdx} className="flex items-center gap-2">
                                <Input
                                  fullWidth
                                  value={val.label}
                                  onChange={(e) => updateOptionValue(gIdx, vIdx, { label: e.target.value })}
                                  placeholder="Nhãn (vd. Size L)"
                                  className={`flex-1 ${adminInputClass}`}
                                  disabled={pending}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step={1000}
                                  value={String(val.priceDelta)}
                                  onChange={(e) => updateOptionValue(gIdx, vIdx, { priceDelta: Number(e.target.value) || 0 })}
                                  placeholder="+0"
                                  className={`w-28 ${adminInputClass}`}
                                  disabled={pending}
                                />
                                {og.values.length > 1 ? (
                                  <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => removeOptionValue(gIdx, vIdx)}
                                    isDisabled={pending}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-fit rounded-xl"
                              onPress={() => addOptionValue(gIdx)}
                              isDisabled={pending}
                            >
                              <Plus className="mr-1.5 size-3.5" />
                              Thêm giá trị
                            </Button>
                          </div>
                        </div>
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-red-500 hover:bg-red-50"
                          onPress={() => removeOptionGroup(gIdx)}
                          isDisabled={pending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Toppings inline editor */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                  Topping
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onPress={addTopping}
                  isDisabled={pending}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Thêm topping
                </Button>
              </div>
              <p className="text-xs text-foreground/50">
                Topping khách có thể thêm tuỳ ý (tùy chọn không bắt buộc).
              </p>
              {toppings.length === 0 ? (
                <p className="text-sm text-foreground/40">Chưa có topping.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {toppings.map((t, tIdx) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl border border-black/8 px-3 py-2">
                      <Input
                        fullWidth
                        value={t.name}
                        onChange={(e) => updateTopping(tIdx, { name: e.target.value })}
                        placeholder="Tên topping"
                        className={`flex-1 ${adminInputClass}`}
                        disabled={pending}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={String(t.price)}
                        onChange={(e) => updateTopping(tIdx, { price: Number(e.target.value) || 0 })}
                        placeholder="Giá"
                        className={`w-28 ${adminInputClass}`}
                        disabled={pending}
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          isSelected={t.isActive}
                          onChange={(v) => updateTopping(tIdx, { isActive: v })}
                          isDisabled={pending}
                          aria-label="Đang bán"
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch>
                        <span className="text-xs text-foreground/50">
                          {t.isActive ? "Bật" : "Tắt"}
                        </span>
                      </div>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-500 hover:bg-red-50"
                        onPress={() => removeTopping(tIdx)}
                        isDisabled={pending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                Hình ảnh
              </h2>
              <p className="text-xs text-foreground/50">
                Dán URL ảnh (CDN, Unsplash, hoặc link công khai). Có thể thêm
                nhiều ảnh; ảnh đầu dùng làm đại diện trong danh sách.
              </p>
              <div className="flex flex-col gap-3">
                {imageUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      fullWidth
                      value={url}
                      onChange={(e) => setImageAt(i, e.target.value)}
                      placeholder="https://…"
                      className="rounded-xl"
                      disabled={pending}
                    />
                    {imageUrls.length > 1 ? (
                      <Button
                        isIconOnly
                        variant="ghost"
                        onPress={() => removeImageRow(i)}
                        isDisabled={pending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="w-fit rounded-xl"
                  onPress={addImageRow}
                  isDisabled={pending}
                >
                  <ImagePlus className="mr-2 size-4" />
                  Thêm dòng URL
                </Button>
              </div>
              {previews.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-black/6 pt-4">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#f3f4f6] ring-1 ring-black/8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previews[0]} alt="" className="size-full object-cover" />
                    {previews.length > 1 && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        1 / {previews.length}
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      Ảnh đại diện
                    </span>
                  </div>
                  {previews.length > 1 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {previews.slice(1).map((src) => (
                        <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-[#f3f4f6] ring-1 ring-black/8">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="size-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                Kho &amp; mã
              </h2>
              <div className={adminFieldStack}>
                <Label className={adminLabelClassProduct}>
                  SKU (Mã sản phẩm)
                </Label>
                <Input
                  fullWidth
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Để trống — tự sinh từ tên (vd. matcha-latte-cot-dua)"
                  className={`w-full ${adminInputClass}`}
                  disabled={pending}
                />
              </div>
              <p className="text-xs text-foreground/45">
                Tuỳ chọn. Để trống khi tạo mới: hệ thống tạo mã từ tên (chữ
                thường, bỏ dấu). Khi sửa, xóa hết ô SKU rồi lưu để sinh lại mã
                từ tên hiện tại.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                Trạng thái bán hàng
              </h2>
              <div className="flex items-center justify-between rounded-xl border border-black/6 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Hiển thị trên app</p>
                  <p className="text-xs text-foreground/50">Khách hàng có thể xem và đặt món</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {isAvailable ? "Đang hiển thị" : "Đang ẩn"}
                  </span>
                  <Switch
                    isSelected={isAvailable}
                    onChange={setIsAvailable}
                    isDisabled={pending}
                    aria-label="Hiển thị món trên ứng dụng khách"
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-black/6 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Hết hàng</p>
                  <p className="text-xs text-foreground/50">Khách thấy nhưng không đặt được</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isSoldOut ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {isSoldOut ? "Hết hàng" : "Còn hàng"}
                  </span>
                  <Switch
                    isSelected={isSoldOut}
                    onChange={setIsSoldOut}
                    isDisabled={pending}
                    aria-label="Đánh dấu hết hàng"
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-black/6 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Best Seller</p>
                  <p className="text-xs text-foreground/50">Badge nổi bật, ưu tiên đề xuất trang chủ</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isBestSeller ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {isBestSeller ? "Best Seller" : "Thường"}
                  </span>
                  <Switch
                    isSelected={isBestSeller}
                    onChange={setIsBestSeller}
                    isDisabled={pending}
                    aria-label="Gắn nhãn Best Seller"
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
