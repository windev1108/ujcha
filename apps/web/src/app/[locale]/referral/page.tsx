import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReferralPageShell } from "./components/ReferralPageShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("referral_friends_title"),
    description: "Chia sẻ mã giới thiệu của bạn và cả hai cùng nhận voucher ưu đãi từ UjCha.",
  };
}

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
