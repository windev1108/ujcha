export const MARGIN_MIN = 0;
export const MARGIN_MAX = 99.99;

export const isValidMargin = (n: number) =>
  Number.isFinite(n) && n >= MARGIN_MIN && n <= MARGIN_MAX;

/** Chỉ để minh hoạ trên form; BE mới là nơi tính giá chính thức. */
export function marginPriceExample(cost: number, margin: number, step = 1000) {
  if (!isValidMargin(margin)) return null;
  return Math.ceil(Number((cost / (1 - margin / 100) / step).toFixed(6))) * step;
}

export const MARGIN_HINT =
  "Giá bán = giá vốn ÷ (1 − biên). Biên tính trên giá bán, không phải trên giá vốn.";