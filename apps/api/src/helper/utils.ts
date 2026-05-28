import { Prisma } from '@prisma/client';
import { ProductOptionGroupDto } from '../modules/admin/product/dto/product-option-group.dto';

export function normalizeOptionGroupValues(raw: unknown): { label: string; priceDelta: number; sortOrder: number }[] {
  if (!Array.isArray(raw)) return [];
  const byLabel = new Map<string, { label: string; priceDelta: number; sortOrder: number }>();
  raw.forEach((v, index) => {
    if (typeof v === 'string') {
      const label = v.trim();
      if (label && !byLabel.has(label))
        byLabel.set(label, { label, priceDelta: 0, sortOrder: index });
    } else if (v && typeof v === 'object' && 'label' in v) {
      const label = String((v as { label: unknown }).label).trim();
      if (!label) return;
      const rawPd = (v as { priceDelta?: unknown }).priceDelta;
      const priceDelta =
        rawPd !== undefined && rawPd !== null && Number.isFinite(Number(rawPd))
          ? Math.min(1e12, Math.max(0, Math.round(Number(rawPd) * 100) / 100))
          : 0;
      const rawSo = (v as { sortOrder?: unknown }).sortOrder;
      const sortOrder = Number.isFinite(Number(rawSo)) ? Number(rawSo) : index;
      if (!byLabel.has(label))
        byLabel.set(label, { label, priceDelta, sortOrder });
    }
  });
  return [...byLabel.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Detect if optionGroups JSON uses new variant-group-ref format. */
export function isVariantGroupRefFormat(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0 &&
    typeof raw[0] === 'object' && raw[0] !== null && 'variantGroupId' in raw[0];
}

/** Extract variantGroupIds from stored JSON. */
export function extractVariantGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { variantGroupId: string } =>
      typeof item === 'object' && item !== null && 'variantGroupId' in item &&
      typeof (item as { variantGroupId: unknown }).variantGroupId === 'string')
    .map(item => item.variantGroupId);
}

/** Expand variant group refs using a pre-fetched map. */
export function expandOptionGroupsWithMap(
  raw: unknown,
  vgMap: Map<string, { id: string; name: string; values: unknown }>,
): { id: string; name: string; values: { label: string; priceDelta: number }[] }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (!isVariantGroupRefFormat(raw)) {
    // Legacy inline format
    return normalizeOptionGroupsFromDb(raw) as { id: string; name: string; values: { label: string; priceDelta: number }[] }[];
  }
  const ids = extractVariantGroupIds(raw);
  return ids.reduce<{ id: string; name: string; values: { label: string; priceDelta: number }[] }[]>((acc, id) => {
    const g = vgMap.get(id);
    if (g) acc.push({ id: g.id, name: g.name, values: normalizeOptionGroupValues(g.values) });
    return acc;
  }, []);
}

/** @deprecated Use normalizeOptionGroupValues instead. Still used for legacy inline groups. */
export function normalizeOptionGroupsFromDb(raw: unknown): unknown {
  if (!Array.isArray(raw)) return [];
  return raw.map((g) => {
    if (!g || typeof g !== 'object') return g;
    const gr = g as Record<string, unknown>;
    const id = typeof gr.id === 'string' ? gr.id : '';
    const name = typeof gr.name === 'string' ? gr.name : '';
    return { ...gr, id, name, values: normalizeOptionGroupValues(gr.values) };
  });
}

export function normalizeImageUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

export function clampDiscountPercent(n: number | undefined, fallback = 0): number {
  if (n === undefined || Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** @deprecated Only kept for legacy compatibility. */
export function normalizeOptionGroups(raw: ProductOptionGroupDto[] | undefined): Prisma.InputJsonValue {
  if (!raw?.length) return [];
  const cleaned = raw.map((g) => {
    const byLabel = new Map<string, { label: string; priceDelta: number }>();
    for (const v of g.values) {
      const label = v.label.trim();
      if (!label) continue;
      const priceDelta = v.priceDelta !== undefined && Number.isFinite(Number(v.priceDelta))
        ? Math.min(1e12, Math.max(0, Math.round(Number(v.priceDelta) * 100) / 100))
        : 0;
      byLabel.set(label, { label, priceDelta });
    }
    return { id: g.id.trim(), name: g.name.trim(), values: [...byLabel.values()] };
  });
  return cleaned as unknown as Prisma.InputJsonValue;
}

export function withNormalizedOptionGroups<T extends { optionGroups: unknown }>(row: T): T {
  return { ...row, optionGroups: normalizeOptionGroupsFromDb(row.optionGroups) };
}
