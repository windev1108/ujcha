"use client";

import { Bell, Coins, FileText, MapPin, Ticket } from "lucide-react";

import { ROUTES } from "@/lib/routes";

import { ProfileLogoutCard } from "./ProfileLogoutCard";
import { ProfileMenuCard } from "./ProfileMenuCard";

type Props = {
  onLogout: () => void;
};

export function ProfileMenuList({ onLogout }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <ProfileMenuCard
        href={ROUTES.ORDERS}
        icon={FileText}
        title="Lịch sử đơn hàng"
        subtitle="Xem lại các món đã đặt"
      />
      <ProfileMenuCard
        href={ROUTES.ADDRESSES}
        icon={MapPin}
        title="Địa chỉ giao hàng"
        subtitle="Quản lý địa điểm nhận nước"
      />
      <ProfileMenuCard
        href={ROUTES.VOUCHERS}
        icon={Ticket}
        iconWrapClassName="bg-purple-50"
        title="Túi voucher"
        subtitle="Mã giảm giá của bạn"
      />
      <ProfileMenuCard
        href={ROUTES.REWARDS}
        icon={Coins}
        iconWrapClassName="bg-amber-50"
        title="Đổi điểm"
        subtitle="Dùng điểm UjCha đổi lấy ưu đãi"
      />
      <ProfileMenuCard
        href={ROUTES.NOTIFICATIONS}
        icon={Bell}
        iconWrapClassName="bg-kun-sage/15"
        title="Thông báo"
        subtitle="Khuyến mãi và cập nhật đơn hàng"
        showNotificationDot
      />
      <ProfileLogoutCard onLogout={onLogout} />
    </div>
  );
}
