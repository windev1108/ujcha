"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, LogIn } from "lucide-react";
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
import { fetchPublicTable, type PublicTableInfo, type VoucherPreviewResult, type CreatedOrder } from "@/services/order/api";
import { saveGuestOrder } from "@/hooks/useGuestOrders";
import { normalizeOptionGroups, computeOptionSurcharge } from "@/lib/product-options";
import { useCartStore } from "@/store/cart-store";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { VoucherSection } from "./VoucherSection";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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

/** Trích mã lỗi từ axios error response. */
function extractErrorCode(err: unknown): string | null {
  return (
    (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? null
  );
}

export function CheckoutPageShell() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isGuest = !accessToken;

  // Server cart (members)
  const { data: serverCart, isLoading: serverCartLoading } = useCartQuery();
  const removeServerCartItems = useRemoveCartItemsMutation();

  // Local cart (guests)
  const localItems = useCartStore((s) => s.items);
  const removeLocalItems = useCartStore((s) => s.removeItems);

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

  // Guests always use new-address form (no saved addresses to pick from)
  const effectiveSavedAddresses = isGuest ? [] : savedAddresses;

  useEffect(() => {
    if (effectiveSavedAddresses.length > 0 && selectedAddressId === null) {
      const def = effectiveSavedAddresses.find((a) => a.isDefault) ?? effectiveSavedAddresses[0];
      setSelectedAddressId(def.id);
    }
  }, [effectiveSavedAddresses, selectedAddressId]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherPreviewResult | null>(null);

  // Source of truth: guest = local Zustand, member = server cart
  const allServerItems = serverCart?.items ?? [];
  const allItems = isGuest ? localItems : allServerItems;

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
        const discountedBase = Number(item.product.finalPrice) || Number(item.product.price) || 0;
        const groups = normalizeOptionGroups(item.product.optionGroups);
        const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
        const toppingTotal = (item.toppings ?? []).reduce(
          (s, t) => s + Number(t.topping?.price ?? 0),
          0,
        );
        return sum + (discountedBase + optionSurcharge + toppingTotal) * item.quantity;
      }, 0),
    [items],
  );

  const isDelivery = tab === CHECKOUT_TAB.DELIVERY;
  // Guests always use "new address" form for delivery
  const isNewAddress = isGuest || selectedAddressId === "__new__" || effectiveSavedAddresses.length === 0;

  const hasValidDeliveryAddress = useMemo(() => {
    if (!isDelivery) return true;
    if (isNewAddress) return !!deliveryForm.fullAddress.trim();
    return !!selectedAddressId;
  }, [isDelivery, isNewAddress, deliveryForm.fullAddress, selectedAddressId]);

  const shippingLat = useMemo(() => {
    if (!isDelivery) return null;
    if (isNewAddress) return deliveryForm.lat;
    const addr = effectiveSavedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lat ?? null;
  }, [isDelivery, isNewAddress, deliveryForm.lat, effectiveSavedAddresses, selectedAddressId]);

  const shippingLng = useMemo(() => {
    if (!isDelivery) return null;
    if (isNewAddress) return deliveryForm.lng;
    const addr = effectiveSavedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lng ?? null;
  }, [isDelivery, isNewAddress, deliveryForm.lng, effectiveSavedAddresses, selectedAddressId]);

  const { data: shippingEstimate } = useShippingEstimateQuery(shippingLat, shippingLng, subtotal);

  const shippingFee = isDelivery ? (shippingEstimate?.fee ?? 0) : 0;
  const shippingIsFree = isDelivery && (shippingEstimate?.isFree ?? false);
  const shippingIsOutOfRange = isDelivery && (shippingEstimate?.isOutOfRange ?? false);
  const shippingIsDisabled = !isDelivery || !shippingEstimate || (shippingEstimate?.isDisabled ?? true);

  const voucherDiscount = appliedVoucher?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - voucherDiscount + shippingFee);

  async function handleSubmitOrder() {
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
      const discountedBase = Number(item.product.finalPrice) || Number(item.product.price) || 0;
      const groups = normalizeOptionGroups(item.product.optionGroups);
      const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
      const toppingTotal = (item.toppings ?? []).reduce(
        (s, t) => s + Number(t.topping?.price ?? 0),
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

      let order: CreatedOrder;

      if (tab === CHECKOUT_TAB.TABLE) {
        order = await createOrderMutation.mutateAsync({
          type: "table",
          paymentType: paymentMethod,
          tableId: tableId!,
          items: orderItems,
          voucherCode: appliedVoucher?.code,
          discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
        });
      } else if (tab === CHECKOUT_TAB.DELIVERY) {
        if (isGuest) {
          // Guests: send as guestDeliveryAddress (never save to DB)
          order = await createOrderMutation.mutateAsync({
            type: "delivery",
            paymentType: paymentMethod,
            guestDeliveryAddress: deliveryForm.fullAddress.trim(),
            guestDeliveryName: deliveryForm.name.trim() || undefined,
            guestDeliveryPhone: deliveryForm.phone.trim() || undefined,
            items: orderItems,
            shippingFee: shippingFee > 0 ? shippingFee : undefined,
          });
        } else if (isNewAddress) {
          // Member + new address: save to DB via inlineAddress
          order = await createOrderMutation.mutateAsync({
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
          });
        } else {
          order = await createOrderMutation.mutateAsync({
            type: "delivery",
            paymentType: paymentMethod,
            addressId: selectedAddressId!,
            items: orderItems,
            voucherCode: appliedVoucher?.code,
            discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
            shippingFee: shippingFee > 0 ? shippingFee : undefined,
          });
        }
      } else {
        const pickupTime =
          pickupForm.mode === "asap"
            ? new Date(Date.now() + 20 * 60_000).toISOString()
            : new Date(pickupForm.scheduledTime).toISOString();

        order = await createOrderMutation.mutateAsync({
          type: "pickup",
          paymentType: paymentMethod,
          pickupTime,
          guestDeliveryName: pickupForm.name.trim() || undefined,
          guestDeliveryPhone: pickupForm.phone.trim() || undefined,
          items: orderItems,
          voucherCode: appliedVoucher?.code,
          discountAmount: voucherDiscount > 0 ? voucherDiscount : undefined,
        });
      }

      // Clear cart after successful order
      if (isGuest) {
        removeLocalItems(orderedItemIds);
        saveGuestOrder({
          paymentCode: order.paymentCode,
          type: order.type as "delivery" | "pickup" | "table",
          totalAmount: parseFloat(order.totalAmount),
          createdAt: new Date().toISOString(),
        });
      } else {
        await removeServerCartItems.mutateAsync(orderedItemIds);
      }

      router.push(ROUTES.ORDER_DETAIL(order.paymentCode));
    } catch (err: unknown) {
      const code = extractErrorCode(err);
      const hasI18nKey = code && code in (t as unknown as Record<string, unknown>);
      setOrderError(
        hasI18nKey
          ? t(code as Parameters<typeof t>[0])
          : t("order_failed"),
      );
    }
  }

  const isLoading = !isGuest && serverCartLoading && items.length === 0;
  if (isLoading) return <CheckoutSkeleton />;

  const isSubmitting = createOrderMutation.isPending;

  return (
    <div className="min-h-screen bg-surface-soft pb-[104px] pt-8 sm:pt-10 lg:pb-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        {/* Guest banner */}
        {isGuest && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-black/6 bg-white px-4 py-3 text-sm">
            <span className="text-muted">{t("guest_checkout_banner")}</span>
            <Link
              href={ROUTES.LOGIN}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
            >
              <LogIn className="size-3.5" />
              {t("guest_checkout_login_cta")}
            </Link>
          </div>
        )}

        <CheckoutHeader tab={tab} onTabChange={setTab} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            <CheckoutFulfillmentSection
              tab={tab}
              deliveryForm={deliveryForm}
              onDeliveryFormChange={(patch) => setDeliveryForm((p) => ({ ...p, ...patch }))}
              pickupForm={pickupForm}
              onPickupFormChange={(patch) => setPickupForm((p) => ({ ...p, ...patch }))}
              savedAddresses={effectiveSavedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              tableName={tableInfo?.name}
              tableArea={tableInfo?.area}
              storeLocation={storeLocation}
              profileName={profile?.name}
              profilePhone={profile?.phone}
            />

            {/* Vouchers: members only */}
            {!isGuest && (
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
            )}

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
              freeShipDistanceKm={shippingEstimate?.freeShipDistanceKm}
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

      {/* Mobile sticky submit bar */}
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
