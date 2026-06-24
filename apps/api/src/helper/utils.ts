import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

// ─── Inline option group helpers ──────────────────────────────────────────────

export type NormalizedOptionValue = {
  label: string;
  priceDelta: number;
  nameTranslation?: Record<string, string>;
};

export type NormalizedOptionGroup = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string>;
  selectionMin: number;
  selectionMax: number;
  values: NormalizedOptionValue[];
};

export type NormalizedTopping = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string>;
  price: number;
  isActive: boolean;
};

export function normalizeOptionGroupValues(raw: unknown): NormalizedOptionValue[] {
  if (!Array.isArray(raw)) return [];
  const byLabel = new Map<string, NormalizedOptionValue>();
  (raw as unknown[]).forEach((v) => {
    if (typeof v === 'string') {
      const label = v.trim();
      if (label && !byLabel.has(label)) byLabel.set(label, { label, priceDelta: 0 });
    } else if (v && typeof v === 'object' && 'label' in v) {
      const label = String((v as { label: unknown }).label).trim();
      if (!label) return;
      const rawPd = (v as { priceDelta?: unknown }).priceDelta;
      const priceDelta =
        rawPd !== undefined && rawPd !== null && Number.isFinite(Number(rawPd))
          ? Math.min(1e12, Math.max(0, Math.round(Number(rawPd) * 100) / 100))
          : 0;
      const rawNt = (v as { nameTranslation?: unknown }).nameTranslation;
      const nameTranslation = rawNt && typeof rawNt === 'object' ? normalizeTranslation(rawNt as Record<string, string>) : undefined;
      if (!byLabel.has(label)) byLabel.set(label, { label, priceDelta, ...(nameTranslation && Object.keys(nameTranslation).length ? { nameTranslation } : {}) });
    }
  });
  return [...byLabel.values()];
}

/** Normalize inline optionGroups array (per-product format). */
export function normalizeInlineOptionGroups(
  raw: unknown,
): NormalizedOptionGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedOptionGroup[] = [];
  for (const g of raw as Record<string, unknown>[]) {
    if (!g || typeof g !== 'object') continue;
    const name = String(g.name ?? '').trim();
    if (!name) continue;
    const id = String(g.id ?? '').trim() || randomUUID();
    const selectionMin = typeof g.selectionMin === 'number' ? Math.max(0, g.selectionMin) : 1;
    const selectionMax = typeof g.selectionMax === 'number' ? Math.max(1, g.selectionMax) : 1;
    const values = normalizeOptionGroupValues(g.values);
    if (values.length === 0) continue;
    const rawNt = g.nameTranslation;
    const nameTranslation = rawNt && typeof rawNt === 'object' ? normalizeTranslation(rawNt as Record<string, string>) : undefined;
    out.push({ id, name, ...(nameTranslation && Object.keys(nameTranslation).length ? { nameTranslation } : {}), selectionMin, selectionMax, values });
  }
  return out;
}

/** Normalize inline toppings array (per-product format). */
export function normalizeInlineToppings(raw: unknown): NormalizedTopping[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedTopping[] = [];
  for (const t of raw as Record<string, unknown>[]) {
    if (!t || typeof t !== 'object') continue;
    const name = String(t.name ?? '').trim();
    if (!name) continue;
    const id = String(t.id ?? '').trim() || randomUUID();
    const price = Number.isFinite(Number(t.price)) ? Math.max(0, Number(t.price)) : 0;
    const isActive = t.isActive !== false;
    const rawNt = t.nameTranslation;
    const nameTranslation = rawNt && typeof rawNt === 'object' ? normalizeTranslation(rawNt as Record<string, string>) : undefined;
    out.push({ id, name, ...(nameTranslation && Object.keys(nameTranslation).length ? { nameTranslation } : {}), price, isActive });
  }
  return out;
}

/** Normalize translation map — strip empty values, limit to known locales. */
export function normalizeTranslation(raw: Record<string, string> | undefined): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [locale, val] of Object.entries(raw)) {
    const v = typeof val === 'string' ? val.trim() : '';
    if (v && locale.length <= 8) out[locale] = v;
  }
  return out;
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

/** Compute effective discounted price, rounded to nearest 1000 VND (≥500 rounds up). */
export function computeFinalPrice(price: unknown, discountPercent: number): number {
  const base = parseFloat(String(price));
  if (!Number.isFinite(base)) return 0;
  if (!discountPercent) return base;
  return Math.round(base * (1 - discountPercent / 100) / 1000) * 1000;
}
