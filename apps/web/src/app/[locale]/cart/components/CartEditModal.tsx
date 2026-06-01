"use client";

import type { ApiCartItem } from "@/services/cart/types";
import { ProductQuickAddModal } from "@/components/product/ProductQuickAddModal";

type Props = {
  item: ApiCartItem | null;
  onClose: () => void;
};

export function CartEditModal({ item, onClose }: Props) {
  return (
    <ProductQuickAddModal
      product={item?.product}
      open={!!item}
      onClose={onClose}
      editItem={item}
    />
  );
}
