import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderPageShell } from "./components/GroupOrderPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("group_order_session_title"),
    description: "Cùng bạn bè đặt hàng nhóm và nhận ưu đãi giảm giá khi có nhiều người tham gia.",
  };
}

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
