import type {
  AdminTopping,
  ProductOptionGroup,
  ProductOptionValue,
} from "@/services/admin/types";

export function toppingsByIdMap(toppings: AdminTopping[]): Map<string, AdminTopping> {
  return new Map(toppings.map((t) => [t.id, t]));
}

/**
 * Sắp xếp giá trị: miễn phí (0đ) trước — giữ thứ tự thêm vào; sau đó là
 * có phụ phí, tăng dần theo giá.
 */
export function sortOptionValues(vals: ProductOptionValue[]): ProductOptionValue[] {
  const free = vals.filter((v) => (v.priceDelta ?? 0) === 0);
  const paid = vals
    .filter((v) => (v.priceDelta ?? 0) > 0)
    .sort((a, b) => (a.priceDelta ?? 0) - (b.priceDelta ?? 0));
  return [...free, ...paid];
}

/** Chuẩn hoá JSON API / legacy string[] → `{ label, priceDelta }[]`. */
export function normalizeProductOptionGroups(raw: unknown): ProductOptionGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") {
      return { id: `g-${i}`, name: "", values: [] };
    }
    const o = item as Record<string, unknown>;
    const values: ProductOptionValue[] = [];
    if (Array.isArray(o.values)) {
      for (const x of o.values) {
        if (typeof x === "string") {
          const label = x.trim();
          if (label) values.push({ label, priceDelta: 0 });
        } else if (x && typeof x === "object" && x !== null && "label" in x) {
          const label = String((x as { label: unknown }).label).trim();
          if (!label) continue;
          let priceDelta = 0;
          const pd = (x as { priceDelta?: unknown }).priceDelta;
          if (pd !== undefined && pd !== null && pd !== "") {
            const n = Number(pd);
            if (Number.isFinite(n) && n >= 0) priceDelta = Math.round(n * 100) / 100;
          }
          values.push({ label, priceDelta });
        }
      }
    }
    return {
      id: typeof o.id === "string" ? o.id : `g-${i}`,
      name: typeof o.name === "string" ? o.name : "",
      values: sortOptionValues(values),
    };
  });
}

/** Phụ phí tối đa nếu chọn mức đắt nhất trong từng nhóm (gợi ý trên thẻ sản phẩm). */
export function maxConfigurableOptionSurcharge(
  groups: ProductOptionGroup[],
): number {
  let sum = 0;
  for (const g of groups) {
    let m = 0;
    for (const v of g.values) {
      const pd = Number.isFinite(v.priceDelta) ? v.priceDelta : 0;
      if (pd > m) m = pd;
    }
    sum += m;
  }
  return Math.round(sum * 100) / 100;
}

function formatCompactVnd(n: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}đ`;
}

/** Chuỗi hiển thị tuỳ chọn trong giỏ (có +phụ phí khi > 0). */
export function formatPosOptionsSubtitle(
  groups: ProductOptionGroup[],
  options: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const g of groups) {
    const sel = options[g.name]?.trim();
    if (!sel) continue;
    const val = g.values.find((v) => v.label === sel);
    const delta = val?.priceDelta ?? 0;
    if (delta > 0) {
      parts.push(`${g.name}: ${sel} (+${formatCompactVnd(delta)})`);
    } else {
      parts.push(`${g.name}: ${sel}`);
    }
  }
  return parts.join(" · ");
}

/** Phụ phí tuỳ chọn nhóm (size, đường…) — khớp logic server `validateOptionsAndSurcharge`. */
export function computeOptionSurcharge(
  optionGroups: ProductOptionGroup[],
  options: Record<string, string>,
): number {
  let add = 0;
  for (const g of optionGroups) {
    const sel = options[g.name]?.trim();
    if (!sel) continue;
    for (const v of g.values) {
      if (v.label === sel) {
        const pd = Number.isFinite(v.priceDelta) ? v.priceDelta : 0;
        add += Math.max(0, pd);
        break;
      }
    }
  }
  return Math.round(add * 100) / 100;
}

/** Đơn giá dòng = giá SP + phụ phí tuỳ chọn nhóm + topping (đồng). */
export function computePosUnitPrice(
  basePrice: number,
  toppingIds: string[],
  map: Map<string, AdminTopping>,
  optionSurcharge = 0,
): number {
  let u = basePrice + optionSurcharge;
  for (const id of toppingIds) {
    const t = map.get(id);
    if (t) u += Number.parseFloat(t.price);
  }
  return Math.round(u * 100) / 100;
}
