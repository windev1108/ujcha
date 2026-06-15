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
  Table,
  Text,
  TextArea,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ArrowLeft, Coins, Minus, Plus, ReceiptTextIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  formatPosOptionsSubtitle,
  normalizeProductOptionGroups,
  toppingsByIdMap,
} from "@/lib/pos-line-price";
import { formatVnd, primaryProductImage } from "@/lib/product-display";
import {
  adminFieldStack,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import { fetchAdminCategories } from "@/services/admin/categories-api";
import { createAdminOrder } from "@/services/admin/orders-api";
import { fetchAdminProducts } from "@/services/admin/products-api";
import { fetchAdminTables } from "@/services/admin/tables-api";
import { fetchAdminToppings } from "@/services/admin/toppings-api";
import { fetchPaymentConfig } from "@/services/admin/payment-config-api";
import { fetchPointConfigCurrent } from "@/services/admin/points-api";
import { fetchUserAddresses, searchAdminUsers } from "@/services/admin/users-api";
import type {
  AdminOrder,
  AdminOrderType,
  AdminPaymentStatus,
  AdminProduct,
} from "@/services/admin/types";

import { PickupDateTimePicker, localDatetimeToIso } from "./PickupDateTimePicker";
import { PosLineModal } from "./pos/PosLineModal";
import type { PosCartLine } from "./pos/pos-types";

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

function lineSubtitle(
  l: PosCartLine,
  toppingMap: Map<string, { name: string }>,
  product: AdminProduct | undefined,
): string {
  const bits: string[] = [];
  if (product && Object.keys(l.options).length > 0) {
    const groups = normalizeProductOptionGroups(product.optionGroups);
    const opt = formatPosOptionsSubtitle(groups, l.options);
    if (opt) bits.push(opt);
  } else if (Object.keys(l.options).length > 0) {
    bits.push(
      Object.entries(l.options)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
    );
  }
  if (l.toppingIds.length) {
    bits.push(
      l.toppingIds
        .map((id) => toppingMap.get(id)?.name ?? id)
        .join(", "),
    );
  }
  if (l.note) bits.push(l.note);
  return bits.join(" · ");
}

function computePointDiscount(
  baseSubtotal: number,
  pointToUse: number,
  pointRate: number,
  maxUsagePercent: number,
): { pointsToSpend: number; discountVnd: number } {
  if (pointToUse < 1 || pointRate < 1) return { pointsToSpend: 0, discountVnd: 0 };
  const maxMoney = (baseSubtotal * maxUsagePercent) / 100;
  const wantMoney = pointRate * pointToUse;
  const capped = Math.min(wantMoney, maxMoney);
  const pointsToSpend = Math.floor(capped / pointRate);
  return { pointsToSpend, discountVnd: pointsToSpend * pointRate };
}

function maxUsablePoints(
  baseSubtotal: number,
  pointBalance: number,
  pointRate: number,
  maxUsagePercent: number,
): number {
  if (pointRate < 1) return 0;
  const maxMoney = (baseSubtotal * maxUsagePercent) / 100;
  return Math.min(Math.floor(maxMoney / pointRate), pointBalance);
}

export function NewOrderClient() {
  const router = useRouter();
  const { showAlert } = useAppDialog();

  const [userQuery, setUserQuery] = useState("");
  const [debouncedUq, setDebouncedUq] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [type, setType] = useState<AdminOrderType>("pickup");
  const [addressId, setAddressId] = useState("");
  const [guestDeliveryName, setGuestDeliveryName] = useState("");
  const [guestDeliveryPhone, setGuestDeliveryPhone] = useState("");
  const [guestDeliveryAddress, setGuestDeliveryAddress] = useState("");
  const [tableId, setTableId] = useState("");
  const [pickupLocal, setPickupLocal] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__all__");
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [pickupMode, setPickupMode] = useState<"asap" | "scheduled">("asap");
  /** Đã thu / chưa thu khi tạo đơn (lưu `paymentStatus` trên đơn). */
  const [paymentStatusOnCreate, setPaymentStatusOnCreate] =
    useState<AdminPaymentStatus>("pending");
  /** Hình thức thanh toán — chỉ dùng ở POS, không gửi lên server. */
  const [paymentType, setPaymentType] = useState<"cash" | "bank_transfer">("cash");
  /** Mang đi / tại bàn: gắn tài khoản khách (tích điểm). Giao hàng: có tài khoản hoặc nhập địa chỉ khách lẻ. */
  const [attachCustomer, setAttachCustomer] = useState(false);
  /** Số điểm khách dùng để giảm giá trong đơn này. */
  const [pointToUse, setPointToUse] = useState(0);

  const [lineProductId, setLineProductId] = useState<string | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedUq(userQuery), 320);
    return () => window.clearTimeout(t);
  }, [userQuery]);

  const { data: users = [] } = useQuery({
    queryKey: ["admin", "users-search", debouncedUq] as const,
    queryFn: () => searchAdminUsers(debouncedUq),
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["admin", "user-addresses", userId] as const,
    queryFn: () => fetchUserAddresses(userId),
    enabled: Boolean(userId) && type === "delivery",
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["admin", "tables"] as const,
    queryFn: fetchAdminTables,
    enabled: type === "table",
  });

  const { data: categories = [] } = useQuery({
    queryKey: adminKeys.categories,
    queryFn: fetchAdminCategories,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products", productSearch, categoryId] as const,
    queryFn: () =>
      fetchAdminProducts({
        q: productSearch.trim() || undefined,
        categoryId:
          categoryId && categoryId !== "__all__" ? categoryId : undefined,
      }),
  });

  const { data: toppings = [] } = useQuery({
    queryKey: adminKeys.toppings,
    queryFn: () => fetchAdminToppings(true),
  });

  const toppingMap = useMemo(() => toppingsByIdMap(toppings), [toppings]);

  // const { data: paymentConfig = null } = useQuery({
  //   queryKey: adminKeys.paymentConfig,
  //   queryFn: fetchPaymentConfig,
  // });

  const { data: pointConfigData = null } = useQuery({
    queryKey: adminKeys.pointConfig,
    queryFn: fetchPointConfigCurrent,
  });

  useEffect(() => {
    if (addresses.length && !addressId) {
      const def = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (def) setAddressId(def.id);
    }
  }, [addresses, addressId]);

  useEffect(() => {
    if (userId.trim()) {
      setGuestDeliveryName("");
      setGuestDeliveryPhone("");
      setGuestDeliveryAddress("");
    }
  }, [userId]);

  useEffect(() => {
    if (!userId.trim() && type === "delivery") setAddressId("");
  }, [userId, type]);

  useEffect(() => {
    if (type !== "pickup" && type !== "table") return;
    if (attachCustomer) return;
    setUserId("");
    setUserQuery("");
  }, [type, attachCustomer]);

  useEffect(() => { setPointToUse(0); }, [userId]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p] as const)),
    [products],
  );

  const lineProduct = useMemo(() => {
    const p = lineProductId ? productById.get(lineProductId) : undefined;
    if (!p) return null;
    return {
      ...p,
      optionGroups: normalizeProductOptionGroups(p.optionGroups),
    };
  }, [productById, lineProductId]);

  const openConfigure = (pid: string) => {
    setLineProductId(pid);
    setConfigureOpen(true);
  };

  const addConfiguredLine = (payload: Omit<PosCartLine, "lineId">) => {
    setLines((prev) => {
      const match = prev.findIndex((l) => {
        if (l.productId !== payload.productId) return false;
        if (l.unitPrice !== payload.unitPrice) return false;
        if ((l.note ?? "") !== (payload.note ?? "")) return false;
        const sortKeys = (o: Record<string, string>) =>
          JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
        if (sortKeys(l.options) !== sortKeys(payload.options)) return false;
        return [...l.toppingIds].sort().join(",") === [...payload.toppingIds].sort().join(",");
      });
      if (match !== -1) {
        return prev.map((l, i) =>
          i === match
            ? { ...l, quantity: Math.min(999_999, l.quantity + payload.quantity) }
            : l,
        );
      }
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return [...prev, { ...payload, lineId: id }];
    });
  };

  const removeLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const setQty = (lineId: string, q: number) => {
    const n = Math.floor(q);
    if (n <= 0) {
      removeLine(lineId);
      return;
    }
    const clamped = Math.min(999_999, n);
    setLines((prev) =>
      prev.map((l) =>
        l.lineId === lineId ? { ...l, quantity: clamped } : l,
      ),
    );
  };

  const subtotal = useMemo(() => {
    let s = 0;
    for (const l of lines) {
      s += l.unitPrice * l.quantity;
    }
    return Math.round(s * 100) / 100;
  }, [lines]);

  const discountNum = Number.parseFloat(discount);
  const discountAmount = Number.isFinite(discountNum)
    ? Math.max(0, discountNum)
    : 0;
  const baseSubtotal = Math.max(0, subtotal - discountAmount);

  const pointCfg = pointConfigData?.config;
  const pointRate = pointCfg?.pointRate ?? 0;
  const maxUsagePct = Number.parseFloat(pointCfg?.maxUsagePercent ?? "0");
  const minOrderAmount = Number.parseFloat(pointCfg?.minOrderAmount ?? "0");
  const pointsEnabled = Boolean(pointCfg?.isActive) && pointRate > 0;

  const selectedUser = useMemo(
    () => (userId ? users.find((u) => u.id === userId) : undefined),
    [users, userId],
  );
  const userPointBalance = selectedUser?.pointBalance ?? 0;

  const pointPickerMax = useMemo(
    () => (pointsEnabled && userId && baseSubtotal >= minOrderAmount
      ? maxUsablePoints(baseSubtotal, userPointBalance, pointRate, maxUsagePct)
      : 0),
    [pointsEnabled, userId, baseSubtotal, minOrderAmount, userPointBalance, pointRate, maxUsagePct],
  );

  const clampedPointToUse = Math.min(pointToUse, pointPickerMax);

  const { discountVnd: pointDiscountVnd } = useMemo(
    () => computePointDiscount(baseSubtotal, clampedPointToUse, pointRate, maxUsagePct),
    [baseSubtotal, clampedPointToUse, pointRate, maxUsagePct],
  );

  const grandTotal = Math.max(0, Math.round((baseSubtotal - pointDiscountVnd) * 100) / 100);

  const createMut = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("Thêm ít nhất một món");
      if (type === "delivery") {
        const uid = userId.trim();
        if (uid) {
          if (!addressId) throw new Error("Chọn địa chỉ giao đã lưu của khách");
        } else if (!guestDeliveryAddress.trim()) {
          throw new Error("Nhập địa chỉ giao (khách không tài khoản)");
        }
      }
      if (type === "table" && !tableId) {
        throw new Error("Chọn bàn");
      }
      let pickupTime: string | undefined;
      if (type === "pickup") {
        if (pickupMode === "asap") {
          pickupTime = new Date().toISOString();
        } else {
          const iso = localDatetimeToIso(pickupLocal);
          if (!iso) throw new Error("Chọn ngày giờ lấy hàng");
          pickupTime = iso;
        }
      }
      const uid = userId.trim();
      return createAdminOrder({
        ...(uid ? { userId: uid } : {}),
        type,
        ...(type === "delivery" && uid && addressId ? { addressId } : {}),
        ...(type === "delivery" && !uid
          ? {
            guestDeliveryAddress: guestDeliveryAddress.trim(),
            ...(guestDeliveryPhone.trim()
              ? { guestDeliveryPhone: guestDeliveryPhone.trim() }
              : {}),
            ...(guestDeliveryName.trim()
              ? { guestDeliveryName: guestDeliveryName.trim() }
              : {}),
          }
          : {}),
        ...(type === "table" && tableId ? { tableId } : {}),
        ...(type === "pickup" && pickupTime ? { pickupTime } : {}),
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          price: l.unitPrice,
          ...(l.toppingIds.length
            ? { extras: l.toppingIds.map((toppingId) => ({ toppingId })) }
            : {}),
          ...(Object.keys(l.options).length ? { options: l.options } : {}),
          ...(l.note ? { note: l.note } : {}),
        })),
        ...(discountAmount > 0 ? { discountAmount } : {}),
        paymentStatus: paymentStatusOnCreate,
        paymentType,
        ...(clampedPointToUse > 0 && userId.trim() ? { pointToUse: clampedPointToUse } : {}),
      });
    },
    onSuccess: (o) => {
      router.push(ROUTES.orderDetail(o.id));
    },
    onError: async (e) =>
      showAlert(
        e instanceof Error ? e.message : axiosMessage(e),
        "Không tạo được đơn",
      ),
  });

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-16 lg:flex-row lg:items-start lg:gap-8">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="ghost"
            className="w-fit gap-2 rounded-full px-3 text-foreground/80 hover:bg-black/4"
            onPress={() => router.push(ROUTES.ORDERS)}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            Quay lại danh sách đơn
          </Button>
          <header className="border-b border-black/6 pb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              POS — Quầy phục vụ
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
              Tạo đơn mới
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/55">
              Chọn món → tuỳ chọn & topping → giỏ tính tiền tự động. In bill khổ
              58mm sau khi tạo đơn.
            </p>
          </header>
        </div>

        <Card className="rounded-2xl border border-black/6 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.08)]">
          <CardContent className="divide-y divide-black/6 p-0 sm:p-0">
            <div className="space-y-6 px-6 py-6 sm:px-7 sm:py-7">
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
                <div className={`min-w-0 ${adminFieldStack}`}>
                  <Label className={adminLabelClass}>
                    Loại đơn
                  </Label>
                  <Select
                    className="w-full min-w-0"
                    value={type}
                    onChange={(key) => {
                      if (key == null) return;
                      const next = key as AdminOrderType;
                      setType(next);
                      if (next === "pickup") setPickupMode("asap");
                    }}
                  >
                    <Select.Trigger className={adminSelectTriggerClass}>
                      <Select.Value className={adminSelectValueClass} />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover placement="bottom start">
                      <ListBox className="min-w-(--trigger-width) outline-none">
                        <ListBox.Item
                          id="pickup"
                          textValue="Mang đi"
                          className="rounded-lg text-sm"
                        >
                          Mang đi
                        </ListBox.Item>
                        <ListBox.Item
                          id="delivery"
                          textValue="Giao hàng"
                          className="rounded-lg text-sm"
                        >
                          Giao hàng
                        </ListBox.Item>
                        <ListBox.Item
                          id="table"
                          textValue="Tại bàn"
                          className="rounded-lg text-sm"
                        >
                          Tại bàn
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className={`min-w-0 ${adminFieldStack}`}>
                  <Label className={adminLabelClass}>
                    Giảm giá (VND)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-11 rounded-xl border border-black/10 bg-white"
                  />
                  <Description className="text-xs leading-relaxed text-foreground/50">
                    Nhập số tiền giảm trực tiếp trên hoá đơn.
                  </Description>
                </div>
              </div>
            </div>

            {type === "delivery" ? (
              <div className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
                <div>
                  <h3 className="text-sm font-semibold text-[#1a3c34]">
                    Khách giao hàng
                  </h3>
                  <p className="mt-1 text-xs text-foreground/55">
                    Chọn khách có tài khoản (địa chỉ đã lưu), hoặc bỏ trống và
                    nhập địa chỉ giao cho khách không đăng ký.
                  </p>
                </div>
                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>
                    Tìm khách (tuỳ chọn)
                  </Label>
                  <Input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Tên, SĐT, email…"
                    className="h-11 rounded-xl border border-black/10 bg-[#f9fafb]"
                  />
                </div>
                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>
                    Chọn khách (tuỳ chọn)
                  </Label>
                  <Select
                    className="w-full"
                    value={userId || undefined}
                    onChange={(key) =>
                      setUserId(key == null ? "" : String(key))
                    }
                    placeholder="Khách không tài khoản — bỏ trống"
                  >
                    <Select.Trigger className={adminSelectTriggerClass}>
                      <Select.Value className={adminSelectValueClass} />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover placement="bottom start">
                      <ListBox className="max-h-56 min-w-(--trigger-width) overflow-y-auto outline-none">
                        {users.map((u) => (
                          <ListBox.Item
                            key={u.id}
                            id={u.id}
                            textValue={`${u.name ?? ""} ${u.phone ?? ""} ${u.email ?? ""}`}
                            className="rounded-lg text-sm"
                          >
                            <span className="font-medium">{u.name ?? "Khách"}</span>
                            <span className="ml-2 text-foreground/50">
                              {u.phone ?? u.email ?? ""}
                            </span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                {userId ? (
                  <div className={adminFieldStack}>
                    <Label className={adminLabelClass}>
                      Địa chỉ giao (đã lưu)
                    </Label>
                    <Description className="text-xs text-foreground/50">
                      Chọn một địa chỉ đã lưu của khách.
                    </Description>
                    <Select
                      className="w-full"
                      value={addressId || undefined}
                      onChange={(key) =>
                        setAddressId(key == null ? "" : String(key))
                      }
                    >
                      <Select.Trigger className={adminSelectTriggerClass}>
                        <Select.Value className={adminSelectValueClass} />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover placement="bottom start">
                        <ListBox className="max-h-48 min-w-(--trigger-width) overflow-y-auto outline-none">
                          {addresses.map((a) => (
                            <ListBox.Item
                              key={a.id}
                              id={a.id}
                              textValue={a.fullAddress}
                              className="rounded-lg text-sm"
                            >
                              {a.fullAddress}
                              {a.isDefault ? (
                                <span className="ml-2 text-xs text-emerald-700">
                                  (Mặc định)
                                </span>
                              ) : null}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-dashed border-black/15 bg-[#fafafa] p-4">
                    <p className="text-xs font-medium text-[#1a3c34]">
                      Giao không tài khoản
                    </p>
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Họ tên (tuỳ chọn)
                      </Label>
                      <Input
                        value={guestDeliveryName}
                        onChange={(e) => setGuestDeliveryName(e.target.value)}
                        placeholder="Người nhận"
                        className="h-11 rounded-xl border border-black/10 bg-white"
                      />
                    </div>
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Số điện thoại (tuỳ chọn)
                      </Label>
                      <Input
                        value={guestDeliveryPhone}
                        onChange={(e) => setGuestDeliveryPhone(e.target.value)}
                        placeholder="09…"
                        className="h-11 rounded-xl border border-black/10 bg-white"
                      />
                    </div>
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Địa chỉ giao cụ thể
                      </Label>
                      <Description className="text-xs text-foreground/50">
                        Bắt buộc khi không chọn khách có tài khoản.
                      </Description>
                      <TextArea
                        value={guestDeliveryAddress}
                        onChange={(e) => setGuestDeliveryAddress(e.target.value)}
                        placeholder="Số nhà, đường, phường…"
                        className="min-h-[88px] rounded-xl border border-black/10 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {type === "pickup" ? (
              <div className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
                <div>
                  <h3 className="text-sm font-semibold text-[#1a3c34]">
                    Thời gian lấy (mang đi)
                  </h3>
                  <p className="mt-1 text-xs text-foreground/55">
                    Lấy ngay dùng giờ hiện tại khi tạo đơn; hẹn giờ để chọn ngày
                    giờ cụ thể.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={pickupMode === "asap" ? "primary" : "ghost"}
                    className={
                      pickupMode === "asap"
                        ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                        : "rounded-full"
                    }
                    onPress={() => setPickupMode("asap")}
                  >
                    Lấy ngay
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pickupMode === "scheduled" ? "primary" : "ghost"}
                    className={
                      pickupMode === "scheduled"
                        ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                        : "rounded-full"
                    }
                    onPress={() => setPickupMode("scheduled")}
                  >
                    Hẹn giờ
                  </Button>
                </div>
                {pickupMode === "scheduled" ? (
                  <div className="max-w-lg space-y-2 pt-1">
                    <PickupDateTimePicker
                      label="Ngày giờ lấy hàng (giờ máy)"
                      value={pickupLocal}
                      onChange={setPickupLocal}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {type === "table" ? (
              <div className="space-y-4 px-6 py-6 sm:px-7 sm:py-7">
                <div className={adminFieldStack}>
                  <Label className={adminLabelClass}>
                    Bàn
                  </Label>
                  <Select
                    className="w-full max-w-md"
                    value={tableId || undefined}
                    onChange={(key) =>
                      setTableId(key == null ? "" : String(key))
                    }
                  >
                    <Select.Trigger className={adminSelectTriggerClass}>
                      <Select.Value className={adminSelectValueClass} />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover placement="bottom start">
                      <ListBox className="max-h-48 min-w-(--trigger-width) outline-none">
                        {tables
                          .filter((t) => t.isActive)
                          .map((t) => (
                            <ListBox.Item
                              key={t.id}
                              id={t.id}
                              textValue={t.name}
                              className="rounded-lg text-sm"
                            >
                              {t.name}
                            </ListBox.Item>
                          ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            ) : null}

            {(type === "pickup" || type === "table") && (
              <div className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
                <div className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-[#fafafa] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-[#1a3c34]">
                      Gắn khách (tuỳ chọn)
                    </p>
                    <p className="text-xs text-foreground/55">
                      Tích điểm UjCha sẽ bổ sung sau — hiện có thể bỏ qua cho
                      khách lẻ tại quầy.
                    </p>
                  </div>
                  <Switch
                    isSelected={attachCustomer}
                    onChange={setAttachCustomer}
                    className="shrink-0"
                    aria-label="Gắn khách"
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
                {attachCustomer ? (
                  <div className="space-y-4">
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Tìm khách
                      </Label>
                      <Input
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Tên, SĐT, email…"
                        className="h-11 rounded-xl border border-black/10 bg-[#f9fafb]"
                      />
                    </div>
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Chọn khách
                      </Label>
                      <Select
                        className="w-full"
                        value={userId || undefined}
                        onChange={(key) =>
                          setUserId(key == null ? "" : String(key))
                        }
                        placeholder="Chọn khách"
                      >
                        <Select.Trigger className={adminSelectTriggerClass}>
                          <Select.Value className={adminSelectValueClass} />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover placement="bottom start">
                          <ListBox className="max-h-56 min-w-(--trigger-width) overflow-y-auto outline-none">
                            {users.map((u) => (
                              <ListBox.Item
                                key={u.id}
                                id={u.id}
                                textValue={`${u.name ?? ""} ${u.phone ?? ""} ${u.email ?? ""}`}
                                className="rounded-lg text-sm"
                              >
                                <span className="font-medium">
                                  {u.name ?? "Khách"}
                                </span>
                                <span className="ml-2 text-foreground/50">
                                  {u.phone ?? u.email ?? ""}
                                </span>
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/6 shadow-[0_8px_30px_-20px_rgba(0,0,0,0.08)]">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <div>
              <h3 className="text-sm font-semibold text-[#1a3c34]">Chọn món</h3>
              <p className="mt-1 text-xs text-foreground/55">
                Tìm theo tên hoặc lọc danh mục — bấm thẻ món để thêm topping /
                tuỳ chọn.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(200px,280px)] lg:items-start">
              <div className={`min-w-0 ${adminFieldStack}`}>
                <Label className={adminLabelClass}>
                  Tìm món
                </Label>
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm tên món…"
                  className="h-11 w-full rounded-xl border border-black/10 bg-[#f9fafb]"
                />
              </div>
              <div className={`min-w-0 ${adminFieldStack}`}>
                <Label className={adminLabelClass}>
                  Danh mục
                </Label>
                <Select
                  className="w-full"
                  value={categoryId}
                  onChange={(key) =>
                    setCategoryId(key == null ? "__all__" : String(key))
                  }
                >
                  <Select.Trigger className={adminSelectTriggerClass}>
                    <Select.Value className={adminSelectValueClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom end">
                    <ListBox className="max-h-56 min-w-(--trigger-width) outline-none">
                      <ListBox.Item
                        id="__all__"
                        textValue="Tất cả"
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
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const thumb = primaryProductImage(p);
                const unavailable = !p.isAvailable || p.isSoldOut;
                // const groups = normalizeProductOptionGroups(p.optionGroups);
                // const maxOpt = maxConfigurableOptionSurcharge(groups);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={unavailable}
                    onClick={() => openConfigure(p.id)}
                    className="flex flex-col items-stretch gap-2 rounded-2xl border border-black/8 bg-white p-3 text-left transition hover:border-[#1a3c34]/40 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f3f4f6]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] text-foreground/35">
                          —
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-[#1a3c34]">
                      {p.name}
                    </p>
                    <div className="space-y-0.5">
                      <p className="xl:text-base text-xs font-semibold tabular-nums text-foreground">
                        {formatVnd(p.price)}
                      </p>
                      {/* {maxOpt > 0 ? (
                        <p className="text-[10px] leading-tight text-foreground/45">
                          Phụ phí tuỳ chọn tối đa +{" "}
                          <span className="font-semibold tabular-nums text-[#1a3c34]/80">
                            {formatVnd(String(maxOpt))}
                          </span>
                        </p>
                      ) : null} */}
                    </div>
                    {unavailable ? (
                      <span className="text-[10px] font-semibold uppercase text-red-600">
                        Ngừng bán
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-24 lg:w-[400px]">
        <Card className="overflow-hidden rounded-2xl border border-black/6 shadow-lg">
          <CardContent className="border-b border-black/6 bg-[#1a3c34] px-4 py-3">
            <p className="text-sm font-bold text-white">Giỏ hàng</p>
            <p className="text-[11px] text-white/75">
              {lines.length} dòng — có thể cùng món khác topping
            </p>
          </CardContent>
          <CardContent className="p-0">
            <Table.Root aria-label="Giỏ POS">
              <Table.Content>
                <Table.Header>
                  <Table.Column
                    isRowHeader
                    textValue="Món"
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground/45"
                  >
                    Món
                  </Table.Column>
                  <Table.Column className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground/45">
                    ĐG
                  </Table.Column>
                  <Table.Column className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground/45">
                    SL
                  </Table.Column>
                  <Table.Column className="w-10 px-2 py-2 text-right text-[10px] font-bold uppercase text-foreground/45">
                    ×
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {lines.map((l) => (
                    <Table.Row key={l.lineId}>
                      <Table.Cell className="max-w-[180px] px-3 py-2 align-top">
                        <p className="text-sm font-semibold leading-snug">
                          {l.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-foreground/50">
                          {lineSubtitle(l, toppingMap, productById.get(l.productId))}
                        </p>
                      </Table.Cell>
                      <Table.Cell className="px-3 py-2 align-top text-xs tabular-nums">
                        {formatVnd(l.unitPrice)}
                      </Table.Cell>
                      <Table.Cell className="px-3 py-2 align-top">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            className="min-h-8 min-w-8"
                            onPress={() => setQty(l.lineId, l.quantity - 1)}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">
                            {l.quantity}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            className="min-h-8 min-w-8"
                            onPress={() => setQty(l.lineId, l.quantity + 1)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-2 py-2 text-right align-top">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onPress={() => removeLine(l.lineId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.Root>
            {lines.length === 0 ? (
              <p className="p-6 text-center text-sm text-foreground/45">
                Chưa có món — bấm vào thẻ sản phẩm để chọn topping / tuỳ chọn.
              </p>
            ) : null}
          </CardContent>
          <CardContent className="space-y-2 border-t border-black/6 bg-[#fafafa] px-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/65">Tạm tính</span>
              <span className="font-semibold tabular-nums">
                {formatVnd(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/65">Giảm giá</span>
              <span className="tabular-nums">{formatVnd(discountAmount)}</span>
            </div>
            {pointDiscountVnd > 0 ? (
              <div className="flex justify-between text-sm text-emerald-700">
                <span className="flex items-center gap-1">
                  <Coins className="size-3.5" />
                  Điểm UjCha ({clampedPointToUse} pt)
                </span>
                <span className="tabular-nums">-{formatVnd(pointDiscountVnd)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-black/8 pt-2 text-base font-bold text-[#1a3c34]">
              <span>Thanh toán</span>
              <span className="tabular-nums">{formatVnd(grandTotal)}</span>
            </div>

            {pointsEnabled && userId && (
              <div className="space-y-2 border-t border-black/8 pt-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1a3c34]">
                    <Coins className="size-3.5" />
                    Dùng điểm UjCha
                  </p>
                  <p className="text-[11px] text-foreground/50">
                    Số dư:{" "}
                    <span className="font-semibold text-foreground">
                      {userPointBalance.toLocaleString("vi-VN")}
                    </span>
                    {" "}pt
                  </p>
                </div>
                {baseSubtotal < minOrderAmount ? (
                  <p className="text-[11px] text-foreground/45">
                    Đơn tối thiểu {formatVnd(minOrderAmount)} để dùng điểm.
                  </p>
                ) : pointPickerMax === 0 ? (
                  <p className="text-[11px] text-foreground/45">
                    Khách chưa có điểm hoặc đơn không đủ điều kiện.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="min-h-7 min-w-7 rounded-lg"
                      onPress={() => setPointToUse((p) => Math.max(0, p - 10))}
                      isDisabled={pointToUse <= 0}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={pointPickerMax}
                      step={1}
                      value={String(pointToUse)}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(pointPickerMax, Number.parseInt(e.target.value, 10) || 0));
                        setPointToUse(v);
                      }}
                      className="h-8 flex-1 rounded-lg border border-black/10 bg-white text-center text-sm"
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="min-h-7 min-w-7 rounded-lg"
                      onPress={() => setPointToUse((p) => Math.min(pointPickerMax, p + 10))}
                      isDisabled={pointToUse >= pointPickerMax}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg border border-[#1a3c34]/25 px-2 text-[11px] text-[#1a3c34]"
                      onPress={() => setPointToUse(pointPickerMax)}
                    >
                      Max
                    </Button>
                  </div>
                )}
                {clampedPointToUse > 0 ? (
                  <p className="text-[11px] text-emerald-700">
                    Giảm{" "}
                    <span className="font-semibold">{formatVnd(pointDiscountVnd)}</span>
                    {" "}({clampedPointToUse} pt × {formatVnd(pointRate)}/pt)
                  </p>
                ) : null}
              </div>
            )}
            <div className={`${adminFieldStack} border-t border-black/8 pt-4`}>
              <Label className={adminLabelClass}>
                Hình thức thanh toán
              </Label>
              <Select
                className="w-full"
                value={paymentType}
                onChange={(key) => {
                  if (key == null) return;
                  setPaymentType(key === "bank_transfer" ? "bank_transfer" : "cash");
                }}
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item
                      id="cash"
                      textValue="Tiền mặt"
                      className="rounded-lg text-sm"
                    >
                      Tiền mặt
                    </ListBox.Item>
                    <ListBox.Item
                      id="bank_transfer"
                      textValue="Chuyển khoản"
                      className="rounded-lg text-sm"
                    >
                      Chuyển khoản
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
              {paymentType === "bank_transfer" && paymentStatusOnCreate === "pending" && (
                <Description className="text-xs text-[#1a3c34]">
                  QR chuyển khoản sẽ hiển thị sau khi tạo đơn.
                </Description>
              )}
            </div>
            <div className={`${adminFieldStack} border-t border-black/8 pt-4`}>
              <Label className={adminLabelClass}>
                Trạng thái thanh toán (khi tạo đơn)
              </Label>
              <Select
                className="w-full"
                value={paymentStatusOnCreate}
                onChange={(key) => {
                  if (key == null) return;
                  setPaymentStatusOnCreate(key === "paid" ? "paid" : "pending");
                }}
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item
                      id="pending"
                      textValue="Chưa thanh toán"
                      className="rounded-lg text-sm"
                    >
                      Chưa thanh toán
                    </ListBox.Item>
                    <ListBox.Item
                      id="paid"
                      textValue="Đã thanh toán"
                      className="rounded-lg text-sm"
                    >
                      Đã thanh toán
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
              <Description className="text-xs text-foreground/50">
                Ghi nhận trên đơn ngay khi tạo (POS / thu tiền mặt).
              </Description>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-full bg-[#1a3c34] font-semibold text-white"
            onPress={() => createMut.mutate()}
            isDisabled={createMut.isPending}
          >
            <ReceiptTextIcon className="mr-1 size-4" />
            {createMut.isPending ? "Đang tạo…" : "Tạo đơn"}
          </Button>
        </div>
        <Text className="text-[11px] text-foreground/45">
          Bill có thể in từ trang chi tiết đơn bất cứ lúc nào.
        </Text>
      </aside>

      <PosLineModal
        product={lineProduct}
        toppings={toppings}
        isOpen={configureOpen}
        onOpenChange={(o) => {
          setConfigureOpen(o);
          if (!o) setLineProductId(null);
        }}
        onConfirm={addConfiguredLine}
      />
    </div>
  );
}
