import type { Metadata } from "next";
import { Suspense } from "react";

import { InventoryPageClient } from "./components/InventoryPageClient";

export const metadata: Metadata = {
    title: "Kho hàng — UjCha Admin",
    description: "Quản lý nguyên liệu, topping và tồn kho",
};

export default function InventoryPage() {
    return (
        <Suspense>
            <InventoryPageClient />
        </Suspense>
    );
}