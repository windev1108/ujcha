import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'item';
}

export function uniqueSlugSuffix(): string {
  return randomBytes(3).toString('hex');
}

/** SKU gợi ý từ tên: lowercase, bỏ dấu, khoảng trắng → `-` (tối đa 80 ký tự). */
export function skuFromProductName(name: string): string {
  const s = slugify(name);
  return s.length > 80 ? s.slice(0, 80) : s;
}
