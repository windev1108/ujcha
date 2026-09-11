"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { IngredientsTab } from "./IngredientsTab";
import { InventoryStatsTab } from "./InventoryStatsTab";
import { ToppingsTab } from "./ToppingsTab";

type TabId = "ingredients" | "toppings" | "stats";

export function InventoryPageClient() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tabParam = searchParams.get("tab");
    const activeTab: TabId =
        tabParam === "toppings" ? "toppings" : tabParam === "ingredients" ? "ingredients" : "stats";

    const setTab = (tab: TabId) => {
        const url = tab === "stats" ? "/inventory" : `/inventory?tab=${tab}`;
        router.replace(url);
    };

    return (
        <div className="flex flex-col gap-6 pb-16">
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#5a8f7a]">
                    Quản lý kho
                </p>
                <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#1a1a1a]">
                    Tồn kho
                </h1>
                <p className="mt-1.5 text-sm text-foreground/50">
                    Quản lý nguyên liệu, topping và theo dõi tồn kho.
                </p>
            </header>

            <div className="flex gap-1 border-b border-black/6 pb-px">
                {(
                    [
                        ["stats", "Thống kê"],
                        ["ingredients", "Nguyên liệu"],
                        ["toppings", "Topping"],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`relative rounded-t-lg px-5 py-2.5 text-sm font-semibold transition-colors ${activeTab === id
                                ? "text-[#1a3c34] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[#1a3c34]"
                                : "text-foreground/50 hover:text-foreground/80"
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === "ingredients" && <IngredientsTab />}
            {activeTab === "toppings" && <ToppingsTab />}
            {activeTab === "stats" && <InventoryStatsTab />}
        </div>
    );
}