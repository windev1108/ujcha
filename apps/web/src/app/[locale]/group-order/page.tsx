import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { GroupOrderLandingShell } from "./components/GroupOrderLandingShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("group_order_page_title"),
    description: "Gọi cả nhóm, giảm thật nhiều. Mời bạn bè cùng chọn món — càng đông càng nhiều ưu đãi.",
    openGraph: {
      title: "Đặt đơn nhóm",
      description: "Mời bạn bè cùng đặt đơn và nhận ưu đãi nhóm tại UjCha.",
      url: "/group-order",
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

export default function GroupOrderLandingPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GroupOrderLandingShell />
    </Suspense>
  );
}
