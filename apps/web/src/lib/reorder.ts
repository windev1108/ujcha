import type { OrderDetail } from "@/services/order/api";
import { fetchGroupOrder, type GroupOrderState } from "@/services/group-order/api";
import type { ApiCartItem, ApiCartProduct, ApiCartTopping } from "@/services/cart/types";

type OptionDetail = { group: string; label: string; nameTranslation?: Record<string, string> };
type ExtraJson = {
  toppingId?: string;
  name?: string;
  price?: number | string;
  nameTranslation?: Record<string, string>;
};

/**
 * Shape tối thiểu cần có để build 1 reorder item — khớp với record OrderItem
 * gốc của Prisma cộng phần `product` được select (id/name/nameTranslation/imageUrls).
 * Dùng chung được cho cả OrderDetail.items và UserOrder.items vì cả hai đều
 * lấy thẳng từ cùng model OrderItem, chỉ khác các field select trên `product`.
 */
type ReorderableOrderItem = {
  id: string;
  quantity: number;
  price: string | number;
  note?: string | null;
  product: { id: string; name: string; nameTranslation?: Record<string, string>; imageUrls: string[] };
  optionsJson?: unknown;
  optionDetailsJson?: unknown;
  extrasJson?: unknown;
};

function parseOptionsJson(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, string>;
  return {};
}
function parseOptionDetailsJson(raw: unknown): OptionDetail[] {
  return Array.isArray(raw) ? (raw as OptionDetail[]) : [];
}
function parseExtrasJson(raw: unknown): ExtraJson[] {
  return Array.isArray(raw) ? (raw as ExtraJson[]) : [];
}

/**
 * Snapshot sản phẩm cho item "đặt lại": `price`/`finalPrice` là đơn giá đã
 * CHỐT từ đơn cũ (gồm cả topping/option cũ), `optionGroups: []` để
 * `computeOptionSurcharge` ở trang checkout luôn trả 0 — tránh cộng phụ phí
 * option/topping thêm lần nữa lên trên đơn giá đã gộp sẵn.
 * Giá cuối cùng luôn được BE tính lại theo `product.price` hiện tại khi tạo
 * đơn thật (xem `buildOrderItemRows`), nên đây chỉ là số hiển thị tạm ở UI.
 */
function buildProductSnapshot(
  product: { id: string; name: string; nameTranslation?: Record<string, string>; imageUrls: string[] },
  unitPrice: number,
): ApiCartProduct {
  return {
    id: product.id,
    name: product.name,
    nameTranslation: product.nameTranslation,
    slug: product.id,
    price: String(unitPrice),
    imageUrls: product.imageUrls ?? [],
    discountPercent: 0,
    finalPrice: unitPrice,
    optionGroups: [],
    category: { name: "", nameTranslation: {} },
  };
}

function toppingsFromExtras(extras: ExtraJson[]): ApiCartTopping[] {
  return extras
    .filter((e): e is ExtraJson & { toppingId: string } => !!e.toppingId)
    .map((e) => ({
      toppingId: e.toppingId,
      topping: {
        id: e.toppingId,
        name: e.name ?? "Topping",
        price: String(e.price ?? 0),
        nameTranslation: e.nameTranslation,
      },
    }));
}

/** Hàm lõi — dùng chung cho items của cả OrderDetail lẫn UserOrder. */
export function buildReorderItemsFromOrderItems(items: ReorderableOrderItem[]): ApiCartItem[] {
  return items.map((item) => {
    const optionDetails = parseOptionDetailsJson(item.optionDetailsJson);
    const selectedOptions =
      optionDetails.length > 0
        ? Object.fromEntries(optionDetails.map((d) => [d.group, d.label]))
        : parseOptionsJson(item.optionsJson);

    const extras = parseExtrasJson(item.extrasJson);
    const unitPrice = parseFloat(item.price as unknown as string);

    return {
      id: `reorder-${item.id}`,
      cartId: "",
      productId: item.product.id,
      quantity: item.quantity,
      selectedOptions,
      toppings: toppingsFromExtras(extras),
      product: buildProductSnapshot(item.product, unitPrice),
      note: item.note ?? undefined,
    };
  });
}

/** Đơn thường (không phải group order) — dùng ở trang chi tiết đơn. */
export function buildReorderItemsFromOrder(order: OrderDetail): ApiCartItem[] {
  return buildReorderItemsFromOrderItems(order.items as unknown as ReorderableOrderItem[]);
}

/** Đơn nhóm — gộp món của tất cả thành viên thành một đơn cá nhân khi đặt lại. */
export function buildReorderItemsFromGroupOrder(groupOrder: GroupOrderState): ApiCartItem[] {
  const out: ApiCartItem[] = [];
  for (const participant of groupOrder.participants) {
    for (const item of participant.items) {
      const toppings: ApiCartTopping[] = (item.toppings ?? []).map((top) => ({
        toppingId: top.toppingId,
        topping: {
          id: top.toppingId,
          name: top.name,
          price: String(top.price ?? 0),
          nameTranslation: top.nameTranslation,
        },
      }));
      const toppingTotal = toppings.reduce((s, t) => s + Number(t.topping.price), 0);
      const unitPrice = Number(item.unitPrice ?? 0) + toppingTotal;

      out.push({
        id: `reorder-${participant.id}-${item.id}`,
        cartId: "",
        productId: item.product.id,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions ?? {},
        toppings,
        // @ts-ignore
        product: buildProductSnapshot(item.product, unitPrice),
        note: item.note ?? undefined,
      });
    }
  }
  return out;
}

export async function fetchAndBuildReorderItemsForGroupOrder(token: string): Promise<ApiCartItem[]> {
  const state = await fetchGroupOrder(token);
  return buildReorderItemsFromGroupOrder(state);
}