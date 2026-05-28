import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderPageShell } from "./components/GroupOrderPageShell";

export const metadata: Metadata = {
  title: "Đơn hàng nhóm",
  description: "Cùng bạn bè đặt hàng nhóm và nhận ưu đãi giảm giá khi có nhiều người tham gia.",
};

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function GroupOrderPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GroupOrderPageShell />
    </Suspense>
  );
}
