export const CHECKOUT_TAB = {
  DELIVERY: "giao-hang",
  PICKUP: "nhan-tai-quan",
  TABLE: "tai-ban",
} as const;

export type CheckoutTabId = (typeof CHECKOUT_TAB)[keyof typeof CHECKOUT_TAB];

export const CHECKOUT_TAB_OPTIONS: { id: CheckoutTabId; labelKey: string }[] = [
  { id: CHECKOUT_TAB.DELIVERY, labelKey: "tab_delivery" },
  { id: CHECKOUT_TAB.PICKUP, labelKey: "tab_pickup" },
];

export function normalizeCheckoutTab(raw: string | null | undefined): CheckoutTabId {
  if (
    raw === CHECKOUT_TAB.DELIVERY ||
    raw === CHECKOUT_TAB.PICKUP ||
    raw === CHECKOUT_TAB.TABLE
  ) {
    return raw;
  }
  return CHECKOUT_TAB.DELIVERY;
}
