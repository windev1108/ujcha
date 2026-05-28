/** Các khu vực / tầng gợi ý trong form & bộ lọc (có thể mở rộng). */
export const TABLE_AREA_PRESETS = [
  "Tầng 1",
  "Tầng 2",
  "Tầng 3",
  "Sân vườn",
  "VIP",
] as const;

/** Gộm preset với khu vực đang có trên bàn (để lọc vẫn thấy bàn cũ). */
export function tableAreaSelectOptions(existingAreas: string[]): string[] {
  const set = new Set<string>(TABLE_AREA_PRESETS);
  for (const a of existingAreas) {
    const t = a?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
}
