import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { RewardsPageShell } from "./components/RewardsPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("redeem_points"),
    description: "Dùng điểm UjCha để đổi voucher giảm giá cho đơn hàng.",
  };
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function RewardsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RewardsPageShell />
    </Suspense>
  );
}
