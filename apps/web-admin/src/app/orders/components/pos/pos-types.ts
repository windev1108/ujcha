export type PosCartLine = {
  lineId: string;
  productId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  toppingIds: string[];
  options: Record<string, string>;
  note?: string;
};
