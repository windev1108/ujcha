"use client";

import { Card, CardContent } from "@heroui/react";
import { useRouter } from "next/navigation";

import { formatVnd } from "@/lib/product-display";
import type { AdminOverviewDashboard } from "@/services/admin/types";

type Props = {
    data: AdminOverviewDashboard | undefined;
    isLoading: boolean;
};

export function TopProductsCard({ data, isLoading }: Props) {
    const router = useRouter();
    const items = data?.topProducts ?? [];

    return (
        <Card className="rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-24px_rgba(0,0,0,0.15)]">
            <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                            Món bán chạy
                        </p>
                        <p className="mt-1 text-sm text-foreground/60">7 ngày gần nhất</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/products?tab=stats")}
                        className="shrink-0 text-xs font-semibold text-[#1a3c34] underline-offset-4 hover:underline"
                    >
                        Xem chi tiết
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col gap-2.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-11 animate-pulse rounded-xl bg-black/[0.04]" />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex h-[160px] items-center justify-center text-sm text-foreground/40">
                        Chưa có đơn nào thanh toán trong 7 ngày qua.
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {items.map((p, i) => (
                            <div key={p.productId} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f0f6f4] text-[11px] font-bold text-[#1a3c34]">
                                    {i + 1}
                                </span>
                                <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6] ring-1 ring-black/[0.06]">
                                    {p.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.imageUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <div className="flex size-full items-center justify-center text-sm opacity-20">🍵</div>
                                    )}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.name}</p>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-bold tabular-nums text-[#1a3c34]">{p.quantitySold} món</p>
                                    <p className="text-[11px] tabular-nums text-foreground/45">{formatVnd(p.revenue)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}