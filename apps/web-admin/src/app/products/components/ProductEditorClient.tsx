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
import { ArrowLeft, Check, ImagePlus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  adminFieldStack,
  adminInputClass,
  adminLabelClassProduct,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { formatVnd } from "@/lib/product-display";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminCategories } from "@/services/admin/categories-api";
import {
  createAdminProduct,
  fetchAdminProduct,
  updateAdminProduct,
} from "@/services/admin/products-api";
import { fetchVariantGroups } from "@/services/admin/variant-groups-api";
import type { AdminProduct } from "@/services/admin/types";

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
  variantGroupIds: string[];
  isAvailable: boolean;
  isSoldOut: boolean;
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
    variantGroupIds: [...input.variantGroupIds].sort(),
    isAvailable: input.isAvailable,
    isSoldOut: input.isSoldOut,
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
    variantGroupIds: existing.optionGroups.map((g) => g.id),
    isAvailable: existing.isAvailable,
    isSoldOut: existing.isSoldOut ?? false,
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

  const { data: variantGroups = [], isLoading: variantGroupsLoading } =
    useQuery({
      queryKey: adminKeys.variantGroups,
      queryFn: fetchVariantGroups,
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
  const [variantGroupIds, setVariantGroupIds] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSoldOut, setIsSoldOut] = useState(false);
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
      setVariantGroupIds(existing.optionGroups.map((g) => g.id));
      setIsAvailable(existing.isAvailable);
      setIsSoldOut(existing.isSoldOut ?? false);
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
            variantGroupIds: [],
            isAvailable: true,
            isSoldOut: false,
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
        variantGroupIds,
        isAvailable,
        isSoldOut,
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
        variantGroupIds,
        isAvailable,
        isSoldOut,
      }),
    [
      sku,
      name,
      categoryId,
      price,
      discountPercent,
      description,
      imageUrls,
      variantGroupIds,
      isAvailable,
      isSoldOut,
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

  const toggleVariantGroup = (id: string) => {
    if (pending) return;
    setVariantGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const previews = useMemo(
    () => imageUrls.map((u) => u.trim()).filter(Boolean),
    [imageUrls],
  );

  const activeVariantGroups = useMemo(
    () => variantGroups.filter((vg) => vg.isActive),
    [variantGroups],
  );

  const priceRange = useMemo(() => {
    const base = Number.parseFloat(price);
    if (!Number.isFinite(base) || base <= 0) return null;
    const selected = variantGroups.filter((vg) => variantGroupIds.includes(vg.id));
    if (!selected.length) return null;
    let minExtra = 0;
    let maxExtra = 0;
    for (const vg of selected) {
      if (!vg.values.length) continue;
      const deltas = vg.values.map((v) =>
        Number.isFinite(v.priceDelta) ? v.priceDelta : 0,
      );
      minExtra += Math.min(...deltas);
      maxExtra += Math.max(...deltas);
    }
    if (maxExtra === 0) return null;
    return { min: base + minExtra, max: base + maxExtra };
  }, [price, variantGroups, variantGroupIds]);

  if (mode === "edit" && loadingProduct) {
    return <p className="text-sm text-foreground/50">Đang tải sản phẩm…</p>;
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 shrink-0 rounded-xl"
            onPress={() => router.push(ROUTES.PRODUCTS)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              Sản phẩm
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34]">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-xl"
            onPress={() => router.push(ROUTES.PRODUCTS)}
          >
            Hủy
          </Button>
          <Button
            className="rounded-xl bg-[#1a3c34] font-semibold text-white"
            onPress={() => {
              setError(null);
              saveMut.mutate();
            }}
            isDisabled={pending || !isDirty}
          >
            <Save className="mr-2 size-4" />
            {pending ? "Đang lưu…" : "Lưu"}
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
                <Description className="text-xs text-foreground/50">
                  0–100%. Cộng với % giảm giá toàn shop (trang danh sách sản
                  phẩm), tối đa 100% tổng giảm.
                </Description>
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

          {/* Variant groups selector */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
                Biến thể
              </h2>
              <p className="text-xs text-foreground/50">
                Chọn các nhóm biến thể áp dụng cho sản phẩm (Size, Đá, Độ
                ngọt…). Quản lý danh sách tại{" "}
                <Link
                  href={ROUTES.CATEGORIES}
                  className="underline hover:text-foreground/80"
                >
                  Danh mục → Biến thể
                </Link>
                .
              </p>
              {variantGroupsLoading ? (
                <p className="text-sm text-foreground/40">Đang tải…</p>
              ) : activeVariantGroups.length === 0 ? (
                <p className="text-sm text-foreground/40">
                  Chưa có biến thể nào — hãy tạo biến thể tại tab Biến thể
                  trong trang Danh mục.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activeVariantGroups.map((vg) => {
                    const checked = variantGroupIds.includes(vg.id);
                    return (
                      <li
                        key={vg.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          checked
                            ? "border-[#71b394]/60 bg-[color-mix(in_oklab,#71b394_8%,white)]"
                            : "border-black/8 hover:bg-black/[0.02]"
                        }`}
                        onClick={() => toggleVariantGroup(vg.id)}
                      >
                        <div
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 ${
                            checked
                              ? "border-[#1a3c34] bg-[#1a3c34]"
                              : "border-black/25"
                          }`}
                        >
                          {checked && <Check className="size-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{vg.name}</p>
                          <p className="text-xs text-foreground/50">
                            {vg.values.map((v) => v.label).join(" · ")}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
                <div className="flex flex-wrap gap-2 border-t border-black/6 pt-4">
                  {previews.map((src) => (
                    <div
                      key={src}
                      className="relative size-16 overflow-hidden rounded-full bg-[#f3f4f6] ring-1 ring-black/8"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="size-full object-cover"
                      />
                    </div>
                  ))}
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
              <div className="flex flex-col gap-1">
                <p className="text-xs text-foreground/55">
                  Hiển thị món trên ứng dụng khách.
                </p>
                <div className="flex items-center gap-3">
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
                  <span className="text-sm font-medium">
                    {isAvailable ? "Đang hiển thị" : "Đang ẩn"}
                  </span>
                </div>
              </div>
              <div className="border-t border-black/6 pt-4">
                <p className="text-xs text-foreground/55">
                  Đánh dấu hết hàng — khách vẫn thấy món (nếu đang hiển thị)
                  và biết tạm thời không đặt được.
                </p>
                <div className="mt-2 flex items-center gap-3">
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
                  <span className="text-sm font-medium">
                    {isSoldOut ? "Hết hàng" : "Còn hàng"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
