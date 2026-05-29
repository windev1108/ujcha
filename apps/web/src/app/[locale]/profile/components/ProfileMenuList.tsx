"use client";

import { Bell, Coins, FileText, MapPin, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";

import { ROUTES } from "@/lib/routes";

import { ProfileLogoutCard } from "./ProfileLogoutCard";
import { ProfileMenuCard } from "./ProfileMenuCard";

type Props = {
  onLogout: () => void;
};

export function ProfileMenuList({ onLogout }: Props) {
  const t = useTranslations();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <ProfileMenuCard
        href={ROUTES.ORDERS}
        icon={FileText}
        title={t("order_history")}
        subtitle={t("order_history_sub")}
      />
      <ProfileMenuCard
        href={ROUTES.ADDRESSES}
        icon={MapPin}
        title={t("shipping_addresses")}
        subtitle={t("manage_delivery_addresses")}
      />
      <ProfileMenuCard
        href={ROUTES.VOUCHERS}
        icon={Ticket}
        iconWrapClassName="bg-purple-50"
        title={t("voucher_bag")}
        subtitle={t("your_discount_codes")}
      />
      <ProfileMenuCard
        href={ROUTES.REWARDS}
        icon={Coins}
        iconWrapClassName="bg-amber-50"
        title={t("redeem_points")}
        subtitle={t("redeem_points_sub")}
      />
      <ProfileMenuCard
        href={ROUTES.NOTIFICATIONS}
        icon={Bell}
        iconWrapClassName="bg-kun-sage/15"
        title={t("notifications")}
        subtitle={t("notifications_sub")}
        showNotificationDot
      />
      <ProfileLogoutCard onLogout={onLogout} />
    </div>
  );
}
