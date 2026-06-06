"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { CheckoutFulfillmentSection } from "./CheckoutFulfillmentSection";
import { CheckoutHeader } from "./CheckoutHeader";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import { PaymentMethodSection } from "./PaymentMethodSection";
import { CHECKOUT_TAB, normalizeCheckoutTab, type CheckoutTabId } from "./checkout-tab";
import type { DeliveryForm, PickupForm, PaymentMethod } from "./checkout-types";
import { useCartQuery, useRemoveCartItemsMutation } from "@/services/cart/hooks";
import {
  useAddressesQuery,
  useCreateOrderMutation,
} from "@/services/order/hooks";
import { useProfileQuery } from "@/services/profile/hooks";
import { usePublicStoreLocationQuery } from "@/services/store/hooks";
import { useShippingEstimateQuery } from "@/services/shipping/hooks";
import { fetchPublicTable, type PublicTableInfo, type VoucherPreviewResult } from "@/services/order/api";
import { normalizeOptionGroups, computeOptionSurcharge } from "@/lib/product-options";

import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { VoucherSection } from "./VoucherSection";
import { useTranslations } from "next-intl";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-8 sm:pb-20 sm:pt-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-secondary" />
          <div className="h-12 w-64 animate-pulse rounded-full bg-surface-secondary" />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <div className="h-64 animate-pulse rounded-3xl bg-surface-secondary" />
            <div className="h-40 animate-pulse rounded-2xl bg-surface-secondary" />
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="h-96 animate-pulse rounded-3xl bg-surface-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutPageShell() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: cart, isLoading } = useCartQuery();
  const removeCartItemsMutation = useRemoveCartItemsMutation();
  const { data: savedAddresses = [] } = useAddressesQuery();
  const createOrderMutation = useCreateOrderMutation();
  const { data: storeLocation } = usePublicStoreLocationQuery();
  const { data: profile } = useProfileQuery();

  const tableIdParam = searchParams.get("tableId") ?? null;

  const selectedItemIds = useMemo(() => {
    const raw = searchParams.get("items");
    if (!raw) return null;
    const ids = raw.split(",").filter(Boolean);
    return ids.length > 0 ? new Set(ids) : null;
  }, [searchParams]);

  const tab = useMemo(() => {
    const raw = searchParams.get("tab");
    if (!raw && searchParams.get("type") === "table") return CHECKOUT_TAB.TABLE;
    return normalizeCheckoutTab(raw);
  }, [searchParams]);

  const setTab = useCallback(
    (next: CheckoutTabId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", next);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const raw = searchParams.get("tab");
    const normalized = normalizeCheckoutTab(raw);
    if (raw !== normalized) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", normalized);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams, tab]);

  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    fullAddress: "",
    name: "",
    phone: "",
    note: "",
    lat: null,
    lng: null,
  });

  const [pickupForm, setPickupForm] = useState<PickupForm>({
    mode: "asap",
    scheduledTime: "",
    name: "",
    phone: "",
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<PublicTableInfo | null>(null);

  useEffect(() => {
    if (tableIdParam) {
      fetchPublicTable(tableIdParam).then(setTableInfo).catch(() => null);
    }
  }, [tableIdParam]);

  useEffect(() => {
    if (savedAddresses.length > 0 && selectedAddressId === null) {
      const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
      setSelectedAddressId(def.id);
    }
  }, [savedAddresses, selectedAddressId]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherPreviewResult | null>(null);

  const allItems = cart?.items ?? [];
  const items = useMemo(
    () =>
      selectedItemIds
        ? allItems.filter((i) => selectedItemIds.has(i.id))
        : allItems,
    [allItems, selectedItemIds],
  );

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const discountedBase = item.product.finalPrice;
        const groups = normalizeOptionGroups(item.product.optionGroups);
        const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
        const toppingTotal = (item.toppings ?? []).reduce(
          (s, t) => s + parseFloat(t.topping.price),
          0,
        );
        return sum + (discountedBase + optionSurcharge + toppingTotal) * item.quantity;
      }, 0),
    [items],
  );

  // Resolve lat/lng for shipping estimate from selected address or form
  const isDelivery = tab === CHECKOUT_TAB.DELIVERY;
  const isNewAddress = selectedAddressId === "__new__" || savedAddresses.length === 0;

  const hasValidDeliveryAddress = useMemo(() => {
    if (!isDelivery) return true;
    if (isNewAddress) return !!deliveryForm.fullAddress.trim();
    return !!selectedAddressId;
  }, [isDelivery, isNewAddress, deliveryForm.fullAddress, selectedAddressId]);

  const shippingLat = useMemo(() => {
    if (!isDelivery) return null;
    if (isNewAddress) return deliveryForm.lat;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lat ?? null;
  }, [isDelivery, isNewAddress, deliveryForm.lat, savedAddresses, selectedAddressId]);

  const shippingLng = useMemo(() => {
    if (!isDelivery) return null;
    if (isNewAddress) return deliveryForm.lng;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lng ?? null;
  }, [isDelivery, isNewAddress, deliveryForm.lng, savedAddresses, selectedAddressId]);

  const { data: shippingEstimate } = useShippingEstimateQuery(shippingLat, shippingLng, subtotal);

  const shippingFee = isDelivery ? (shippingEstimate?.fee ?? 0) : 0;
  const shippingIsFree = isDelivery && (shippingEstimate?.isFree ?? false);
  const shippingIsOutOfRange = isDelivery && (shippingEstimate?.isOutOfRange ?? false);
  const shippingIsDisabled = !isDelivery || !shippingEstimate || (shippingEstimate?.isDisabled ?? true);

  const voucherDiscount = appliedVoucher?.discountAmount ?? 0;

  const total = Math.max(0, subtotal - voucherDiscount + shippingFee);

  async function handleSubmitOrder() {
    if (!accessToken) {
      router.push(ROUTES.LOGIN);
      return;
    }

    setOrderError(null);

    if (items.length === 0) {
      setOrderError(t("error_cart_empty"));
      return;
    }

    const tableId = tableIdParam;

    if (tab === CHECKOUT_TAB.TABLE) {
      if (!tableId) {
        setOrderError(t("error_table_not_found_qr"));
        return;
      }
    }

    if (tab === CHECKOUT_TAB.DELIVERY) {
      if (shippingIsOutOfRange) {
        setOrderError(t("error_delivery_out_of_range"));
        return;
      }
      if (isNewAddress) {
        if (!deliveryForm.fullAddress.trim()) {
          setOrderError(t("error_enter_delivery_address"));
          return;
        }
        if (!deliveryForm.name.trim()) {
          setOrderError(t("error_enter_recipient_name"));
          return;
        }
        if (!deliveryForm.phone.trim()) {
          setOrderError(t("error_enter_phone"));
          return;
        }
      } else if (!selectedAddressId) {
        setOrderError(t("error_select_address"));
        return;
      }
    }

    if (tab === CHECKOUT_TAB.PICKUP) {
      if (!pickupForm.name.trim()) {
        setOrderError(t("error_enter_contact_name"));
        return;
      }
      if (!pickupForm.phone.trim()) {
        setOrderError(t("error_enter_phone"));
        return;
      }
      if (pickupForm.mode === "scheduled" && !pickupForm.scheduledTime) {
        setOrderError(t("error_select_pickup_time"));
        return;
      }
    }

    for (const item of items) {
      const groups = normalizeOptionGroups(item.product.optionGroups).filter(
        (g) => g.values.length > 0,
      );
      for (const grp of groups) {
        if (!item.selectedOptions[grp.name]?.trim()) {
          setOrderError(t("error_option_required", { product: item.product.name, option: grp.name }));
          return;
        }
      }
    }

    const orderItems = items.map((item) => {
      const discountedBase = item.product.finalPrice;
      const groups = normalizeOptionGroups(item.product.optionGroups);
      const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
      const toppingTotal = item.toppings.reduce(
        (s, t) => s + parseFloat(t.topping.price),
        0,
      );
      const unitPrice = discountedBase + optionSurcharge + toppingTotal;

      const optionTranslations: Record<string, Record<string, string>> = {};
      for (const g of groups) {
        const sel = item.selectedOptions[g.name];
        if (sel) {
          const v = g.values.find((v) => v.label === sel);
          if (v?.nameTranslation) optionTranslations[g.name] = v.nameTranslation;
        }
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: unitPrice,
        options: item.selectedOptions as Record<string, string>,
        extras: (item.toppings ?? []).map((t) => ({
          toppingId: t.toppingId,
          nameTranslation: t.topping.nameTranslation,
        })),
        ...(Object.keys(optionTranslations).length > 0 ? { optionTranslations } : {}),
      };
    });

    try {
      const orderedItemIds = items.map((i) => i.id);

      if (tab === CHECKOUT_TAB.TABLE) {
        const order = await createOrderMutation.mutateAsync({
          type: "table",
          paymentType: paymentMethod,
          tableId: tableId!,
          items: orderItems,
          voucherCode: appliedVoucher?.code,
          discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
        });
        await removeCartItemsMutation.mutateAsync(orderedItemIds);
        router.push(ROUTES.ORDER_DETAIL(order.paymentCode));
        return;
      } else if (tab === CHECKOUT_TAB.DELIVERY) {
        const order = await createOrderMutation.mutateAsync(
          isNewAddress
            ? {
                type: "delivery",
                paymentType: paymentMethod,
                inlineAddress: {
                  fullAddress: deliveryForm.fullAddress.trim(),
                  lat: deliveryForm.lat ?? 0,
                  lng: deliveryForm.lng ?? 0,
                },
                guestDeliveryName: deliveryForm.name.trim() || undefined,
                guestDeliveryPhone: deliveryForm.phone.trim() || undefined,
                items: orderItems,
                voucherCode: appliedVoucher?.code,
                discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
                shippingFee: shippingFee > 0 ? shippingFee : undefined,
              }
            : {
                type: "delivery",
                paymentType: paymentMethod,
                addressId: selectedAddressId!,
                items: orderItems,
                voucherCode: appliedVoucher?.code,
                discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
                shippingFee: shippingFee > 0 ? shippingFee : undefined,
              },
        );
        await removeCartItemsMutation.mutateAsync(orderedItemIds);
        router.push(ROUTES.ORDER_DETAIL(order.paymentCode));
        return;
      } else {
        const pickupTime =
          pickupForm.mode === "asap"
            ? new Date(Date.now() + 20 * 60_000).toISOString()
            : new Date(pickupForm.scheduledTime).toISOString();

        const order = await createOrderMutation.mutateAsync({
          type: "pickup",
          paymentType: paymentMethod,
          pickupTime,
          guestDeliveryName: pickupForm.name.trim() || undefined,
          guestDeliveryPhone: pickupForm.phone.trim() || undefined,
          items: orderItems,
          voucherCode: appliedVoucher?.code,
          discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
        });
        await removeCartItemsMutation.mutateAsync(orderedItemIds);
        router.push(ROUTES.ORDER_DETAIL(order.paymentCode));
        return;
      }
    } catch (err: unknown) {
      const raw =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setOrderError(
        Array.isArray(raw) ? t("order_failed") : (raw ?? t("order_failed")),
      );
    }
  }

  if (!accessToken || (isLoading && items.length === 0)) return <CheckoutSkeleton />;

  const isSubmitting = createOrderMutation.isPending;

  return (
    <div className="min-h-screen bg-surface-soft pb-[104px] pt-8 sm:pt-10 lg:pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <CheckoutHeader tab={tab} onTabChange={setTab} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            <CheckoutFulfillmentSection
              tab={tab}
              deliveryForm={deliveryForm}
              onDeliveryFormChange={(patch) => setDeliveryForm((p) => ({ ...p, ...patch }))}
              pickupForm={pickupForm}
              onPickupFormChange={(patch) => setPickupForm((p) => ({ ...p, ...patch }))}
              savedAddresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              tableName={tableInfo?.name}
              tableArea={tableInfo?.area}
              storeLocation={storeLocation}
              profileName={profile?.name}
              profilePhone={profile?.phone}
            />

            <div className="mt-4 space-y-3 rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("offers")}
              </p>
              <VoucherSection
                subtotal={subtotal}
                applied={appliedVoucher}
                onApply={setAppliedVoucher}
                onRemove={() => setAppliedVoucher(null)}
              />
            </div>

            <PaymentMethodSection
              selected={paymentMethod}
              onSelect={setPaymentMethod}
            />
          </div>

          <div className="relative min-w-0 lg:col-span-5 xl:col-span-4">
            <CheckoutOrderSummary
              items={items}
              subtotal={subtotal}
              discount={voucherDiscount}
              pointDiscount={0}
              shippingFee={shippingFee}
              shippingIsFree={shippingIsFree}
              shippingIsOutOfRange={shippingIsOutOfRange}
              shippingIsDisabled={shippingIsDisabled}
              distanceKm={shippingEstimate?.distanceKm}
              total={total}
              isDelivery={isDelivery}
              isSubmitting={isSubmitting}
              isSuccess={false}
              isAddressInvalid={!hasValidDeliveryAddress}
              errorMessage={orderError}
              onSubmit={() => void handleSubmitOrder()}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile sticky submit bar (hidden on lg+) ────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/6 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm lg:hidden">
        {orderError && (
          <div className="mb-2.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span>{orderError}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
              {t("order_total")}
            </p>
            <p className="text-xl font-bold tabular-nums text-kun-primary">
              {formatVnd(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSubmitOrder()}
            disabled={isSubmitting || items.length === 0 || (isDelivery && shippingIsOutOfRange) || !hasValidDeliveryAddress}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("placing_order")}
              </>
            ) : (
              <>
                {isDelivery ? t("confirm_delivery_order") : t("confirm_order_short")}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
