import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GroupOrderPageShell } from "./components/GroupOrderPageShell";
import { GroupOrderGoneShell } from "./components/GroupOrderGoneShell";
import type { GroupOrderState } from "@/services/group-order/api";
import { env } from "@/config/env";
import { ROUTES } from "@/lib/routes";

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

async function fetchGroupOrderSSR(token: string): Promise<GroupOrderState | null> {
  try {
    const res = await fetch(`${env.API_URL}/group-orders/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<GroupOrderState>;
  } catch {
    return null;
  }
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default async function GroupOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const go = await fetchGroupOrderSSR(token);

  if (!go) {
    return <GroupOrderGoneShell type="not_found" token={token} />;
  }

  if (go.status === "cancelled") {
    return <GroupOrderGoneShell type="dissolved" token={token} />;
  }

  if (new Date(go.expiresAt) < new Date()) {
    return <GroupOrderGoneShell type="expired" token={token} />;
  }

  if (go.status === "completed" && go.order?.paymentCode) {
    redirect(ROUTES.ORDER_DETAIL(go.order.paymentCode));
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <GroupOrderPageShell />
    </Suspense>
  );
}
