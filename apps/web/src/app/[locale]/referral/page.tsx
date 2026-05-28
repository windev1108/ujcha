import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReferralPageShell } from "./components/ReferralPageShell";

export const metadata: Metadata = {
  title: "Giới thiệu bạn bè",
  description: "Chia sẻ mã giới thiệu của bạn và cả hai cùng nhận voucher ưu đãi từ UjCha.",
};

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function ReferralPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReferralPageShell />
    </Suspense>
  );
}
