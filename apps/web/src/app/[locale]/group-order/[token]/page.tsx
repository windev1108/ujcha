import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderPageShell } from "./components/GroupOrderPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const title = t("group_order_session_title");
  const description = "Cùng bạn bè đặt hàng nhóm và nhận ưu đãi giảm giá khi có nhiều người tham gia.";
  return {
    title,
    description,
    openGraph: {
      title: "Đặt hàng nhóm cùng UjCha — Càng đông càng rẻ!",
      description,
      type: "website",
      images: [{ url: "/og/group-order.png", width: 1200, height: 630, alt: "UjCha Group Order" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Đặt hàng nhóm cùng UjCha — Càng đông càng rẻ!",
      description,
      images: ["/og/group-order.png"],
    },
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
