"use client";

import { Button } from "@heroui/react";
import { Package } from "lucide-react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { ProductStatsTab } from "./ProductStatsTab";


export function RevenueStatsPageClient() {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-6 pb-16">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5a8f7a]">
                        Báo cáo
                    </p>
                    <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#1a1a1a]">
                        Thống kê doanh thu / lợi nhuận
                    </h1>
                    <p className="mt-1.5 text-sm text-foreground/50">
                        Doanh thu, giá vốn, lợi nhuận và mức độ phủ giá vốn theo món và danh mục.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    onPress={() => router.push(ROUTES.PRODUCTS)}
                    className="h-9 shrink-0 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-foreground/70 transition hover:border-[#1a3c34]/25 hover:bg-[#f7faf9] hover:text-[#1a3c34]"
                >
                    <Package className="mr-1.5 size-3.5 text-[#5a8f7a]" />
                    Quản lý sản phẩm
                </Button>
            </header>

            <ProductStatsTab />
        </div>
    );
}