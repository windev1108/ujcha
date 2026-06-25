"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { XCircle, Clock, Users } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { clearGroupOrderSession } from "@/hooks/useGroupOrderSessions";
import { ROUTES } from "@/lib/routes";

export type GroupOrderGoneType = "not_found" | "expired" | "dissolved";

const CONFIG: Record<
  GroupOrderGoneType,
  {
    Icon: React.ElementType;
    iconBg: string;
    iconRing: string;
    iconColor: string;
    titleKey: string;
    descKey: string;
  }
> = {
  not_found: {
    Icon: XCircle,
    iconBg: "bg-red-50",
    iconRing: "ring-red-200",
    iconColor: "text-red-500",
    titleKey: "GROUP_ORDER_NOT_FOUND",
    descKey: "group_not_found_desc",
  },
  expired: {
    Icon: Clock,
    iconBg: "bg-amber-50",
    iconRing: "ring-amber-200",
    iconColor: "text-amber-500",
    titleKey: "GROUP_ORDER_EXPIRED",
    descKey: "group_expired_desc",
  },
  dissolved: {
    Icon: Users,
    iconBg: "bg-amber-50",
    iconRing: "ring-amber-200",
    iconColor: "text-amber-500",
    titleKey: "group_dissolved_title",
    descKey: "group_dissolved_desc",
  },
};

export function GroupOrderGoneShell({
  type,
  token,
}: {
  type: GroupOrderGoneType;
  token: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { Icon, iconBg, iconRing, iconColor, titleKey, descKey } = CONFIG[type];

  useEffect(() => {
    clearGroupOrderSession(token);
  }, [token]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-black/6 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)]">
        <div
          className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ${iconBg} ring-1 ${iconRing}`}
        >
          <Icon className={`size-8 ${iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {t(titleKey as Parameters<typeof t>[0])}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(descKey as Parameters<typeof t>[0])}
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.HOME)}
          className="mt-6 w-full rounded-full bg-[#1a3c34] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t("go_home")}
        </button>
      </div>
    </div>
  );
}
