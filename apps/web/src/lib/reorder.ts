import type { OrderDetail } from "@/services/order/api";
import { fetchGroupOrder, type GroupOrderState } from "@/services/group-order/api";
import { fetchProductsByIds } from "@/services/cart/api";
import type { ApiCartItem, ApiCartProduct, ApiCartTopping } from "@/services/cart/types";
import { normalizeOptionGroups } from "./product-options";

type OptionDetail = { group: string; label: string };
type ExtraJson = { toppingId?: string };

export type ReorderRequestItem = {
  productId: string;
  quantity: number;
  selectedOptions: Record<string, string>;
  toppingIds: string[];
  note?: string | null;
};

type ReorderableOrderItem = {
  quantity: number;
  note?: string | null;
  product: { id: string };
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

function toReorderRequest(item: ReorderableOrderItem): ReorderRequestItem {
  const optionDetails = parseOptionDetailsJson(item.optionDetailsJson);
  const selectedOptions =
    optionDetails.length > 0
      ? Object.fromEntries(optionDetails.map((d) => [d.group, d.label]))
      : parseOptionsJson(item.optionsJson);

  const extras = parseExtrasJson(item.extrasJson);
  const toppingIds = extras.filter((e) => !!e.toppingId).map((e) => e.toppingId as string);

  return {
    productId: item.product.id,
    quantity: item.quantity,
    selectedOptions,
    toppingIds,
    note: item.note,
  };
}

/** Đơn thường (OrderDetail.items) — dùng ở trang chi tiết đơn. */
export function extractReorderRequestFromOrder(order: OrderDetail): ReorderRequestItem[] {
  return (order.items as unknown as ReorderableOrderItem[]).map(toReorderRequest);
}

/** Đơn thường — dùng chung khi chỉ có mảng items (vd UserOrder.items ở trang danh sách). */
export function extractReorderRequestFromOrderItems(items: ReorderableOrderItem[]): ReorderRequestItem[] {
  return items.map(toReorderRequest);
}

/** Đơn nhóm — gộp món của tất cả thành viên thành một đơn cá nhân khi đặt lại. */
export function extractReorderRequestFromGroupOrder(groupOrder: GroupOrderState): ReorderRequestItem[] {
  const out: ReorderRequestItem[] = [];
  for (const participant of groupOrder.participants) {
    for (const item of participant.items) {
      out.push({
        productId: item.product.id,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions ?? {},
        toppingIds: (item.toppings ?? []).map((t) => t.toppingId),
        note: item.note,
      });
    }
  }
  return out;
}

/** Helper cho nơi chỉ có `groupOrderToken` (chưa fetch state) — vd trang danh sách đơn. */
export async function extractReorderRequestForGroupOrderToken(token: string): Promise<ReorderRequestItem[]> {
  const state = await fetchGroupOrder(token);
  return extractReorderRequestFromGroupOrder(state);
}

/**
 * Resolve các "yêu cầu đặt lại" (chỉ có productId/option/topping đã chọn) theo
 * DỮ LIỆU SẢN PHẨM HIỆN TẠI (giá, khuyến mãi, option groups, toppings) — thay
 * vì dùng giá snapshot cũ từ đơn hàng trước. Option/topping nào không còn tồn
 * tại trên sản phẩm hiện tại sẽ bị bỏ qua thay vì gây lỗi ở bước checkout.
 * Sản phẩm đã bị xoá/ngừng bán hoàn toàn sẽ bị loại khỏi kết quả, đếm ở
 * `unavailableCount` để UI báo cho người dùng biết.
 */

function toProductArray(raw: unknown): ApiCartProduct[] {
  if (Array.isArray(raw)) return raw as ApiCartProduct[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as ApiCartProduct[];
    if (Array.isArray(obj.data)) return obj.data as ApiCartProduct[];
    return Object.values(obj) as ApiCartProduct[]; // record dạng { [id]: product }
  }
  return [];
}

export async function resolveReorderItems(
  requests: ReorderRequestItem[],
  locale: string,
): Promise<{ items: ApiCartItem[]; unavailableCount: number }> {
  const productIds = [...new Set(requests.map((r) => r.productId))];
  if (productIds.length === 0) return { items: [], unavailableCount: 0 };

  const raw: unknown = await fetchProductsByIds(productIds, locale);
  const products = toProductArray(raw);
  const productMap = new Map<string, ApiCartProduct>(products.map((p) => [p.id, p]));

  const items: ApiCartItem[] = [];
  let unavailableCount = 0;

  requests.forEach((req, idx) => {
    const product = productMap.get(req.productId);
    if (!product) {
      unavailableCount += 1;
      return;
    }

    // Chỉ giữ lại option nhóm nào vẫn còn tồn tại trên sản phẩm hiện tại
    const normalizedGroups = normalizeOptionGroups(product.optionGroups);
    const validGroupNames = new Set(normalizedGroups.map((g) => g.name));
    const selectedOptions = Object.fromEntries(
      Object.entries(req.selectedOptions).filter(([group]) => validGroupNames.has(group)),
    );

    // Chỉ giữ lại topping còn active trên sản phẩm hiện tại
    const currentToppingsById = new Map((product.toppings ?? []).map((tp) => [tp.id, tp]));
    const toppings: ApiCartTopping[] = req.toppingIds
      .map((id) => currentToppingsById.get(id))
      .filter((tp): tp is NonNullable<typeof tp> => !!tp && tp.isActive !== false)
      .map((tp) => ({
        toppingId: tp.id,
        topping: { id: tp.id, name: tp.name, price: String(tp.price), nameTranslation: tp.nameTranslation },
      }));

    items.push({
      id: `reorder-${idx}-${req.productId}`,
      cartId: "",
      productId: req.productId,
      quantity: req.quantity,
      selectedOptions,
      toppings,
      product, // ← giá/khuyến mãi lấy theo hiện tại, không phải giá lúc đặt đơn cũ
      note: req.note ?? undefined,
    });
  });

  return { items, unavailableCount };
}