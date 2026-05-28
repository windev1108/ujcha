import type { Metadata } from "next";
import { Suspense } from "react";

import { ReferralsPageClient } from "./components/ReferralsPageClient";

export const metadata: Metadata = {
  title: "Quản lý giới thiệu — UjCha Admin",
  description: "Theo dõi lượt giới thiệu, phần thưởng và cấu hình chương trình",
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
      <ReferralsPageClient />
    </Suspense>
  );
}
