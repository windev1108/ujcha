// src/lib/constants/geo.ts
import type { BoundingBox } from "@/components/common/AddressAutocompleteInput";

/** Bounding box bao trọn TP. Đà Nẵng (nội thành + ngoại ô, gồm Sơn Trà, Ngũ Hành Sơn, Hòa Vang). */
export const DA_NANG_BOUNDING_BOX: BoundingBox = {
    west: 107.95,
    north: 16.20,
    east: 108.35,
    south: 15.90,
};

export const DA_NANG_QUERY_SUFFIX = "Đà Nẵng, Việt Nam";