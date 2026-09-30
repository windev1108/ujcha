import type { Metadata } from "next";
import { Suspense } from "react";

import { RevenueStatsPageClient } from "./components/RevenueStatsPageClient";

export const metadata: Metadata = {
    title: "Quản lý doanh thu — UjCha Admin",
    description: "Theo dõi phân tích lợi nhuận",
};

export default function ReferralsPage() {
    return (
        <Suspense
            fallback={
                <div className="animate-pulse rounded-2xl bg-black/[0.06] p-12 text-sm text-foreground/45">
                    Đang tải…
                </div>
            }
        >
            <RevenueStatsPageClient />
        </Suspense>
    );
}
