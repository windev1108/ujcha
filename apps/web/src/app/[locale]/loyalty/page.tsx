import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoyaltyPageShell } from "./components/LoyaltyPageShell";

export const metadata: Metadata = {
  title: "Tích điểm thưởng",
  description: "Tích điểm từ đơn hàng để nhận ưu đãi từ UjCha.",
};

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function LoyaltyPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LoyaltyPageShell />
    </Suspense>
  );
}
