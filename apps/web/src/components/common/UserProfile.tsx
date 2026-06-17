"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Avatar, Dropdown } from "@heroui/react";
import { UserIcon, FileText, LogOut, MapPin, MessageSquare, Star, StoreIcon, Ticket, User, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useProfileQuery } from "@/services/profile/hooks";
import { fetchMyGroupOrderSessions } from "@/services/group-order/api";
import { ROUTES } from "@/lib/routes";

// React 19 no longer infers `children` / image props automatically from ComponentPropsWithRef;
// these casts allow using the compound components without `{...({} as never)}` hacks.
const Av = Avatar as unknown as React.FC<{ className?: string; children?: React.ReactNode }>;
const AvImg = Avatar.Image as unknown as React.FC<{ src?: string; className?: string }>;
const AvFb = Avatar.Fallback as unknown as React.FC<{ children?: React.ReactNode; className?: string }>;

export const UserProfile = ({ onNavigate }: { onNavigate?: () => void } = {}) => {
  const t = useTranslations();
  const { isLoggedIn, user } = useAuth();
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();
  const { data: profile } = useProfileQuery();
  const [minMinsLeft, setMinMinsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchMyGroupOrderSessions()
      .then((sessions) => {
        if (sessions.length > 0) {
          const minMs = Math.min(...sessions.map((s) => new Date(s.expiresAt).getTime() - Date.now()));
          setMinMinsLeft(Math.max(0, Math.ceil(minMs / 60_000)));
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("account")}
          className="flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#1a3c34]/40"
        >
          <div className="flex size-9 items-center justify-center rounded-full text-foreground/60 transition hover:bg-black/6">
            <UserIcon className="size-5" />
          </div>
        </Dropdown.Trigger>

        <Dropdown.Popover className="w-52 rounded-2xl max-sm:w-[calc(100vw-2rem)]">
          <Dropdown.Menu>
            <Dropdown.Section>
              <Dropdown.Item
                textValue={t("guest_orders_login_btn")}
                onPress={() => { onNavigate?.(); router.push(ROUTES.LOGIN); }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2.5 py-0.5 text-sm font-semibold text-[#1a3c34]">
                  <UserIcon className="size-4 shrink-0" />
                  {t("guest_orders_login_btn")}
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                textValue={t("guest_orders_register_cta")}
                onPress={() => { onNavigate?.(); router.push(ROUTES.REGISTER); }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground/65">
                  <span className="flex size-4 shrink-0 items-center justify-center font-semibold text-foreground/35">+</span>
                  {t("guest_orders_register_cta")}
                </div>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );
  }
  const name = user?.name?.trim() || "Tài khoản";
  const sub = user?.email?.trim() || user?.phone?.trim() || "";
  const initial = name.charAt(0).toUpperCase();
  const points = profile?.pointBalance ?? 0;

  return (
    <Dropdown>
      {/* Dropdown.Trigger renders as a <button> — Avatar goes directly inside, no extra wrapper */}
      <Dropdown.Trigger
        aria-label={t("account")}
        className="flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-kun-products-forest/60"
      >
        <Av className="size-8 cursor-pointer border-2  focus-visible:ring-2 focus-visible:ring-kun-products-forest/60">
          <AvImg src={user?.avatar ?? undefined} />
          <AvFb>{initial}</AvFb>
        </Av>
      </Dropdown.Trigger>

      <Dropdown.Popover className="w-64 rounded-2xl">
        <Dropdown.Menu>
          {/* User header — no onPress so it acts as a display item */}
          <Dropdown.Section>
            <Dropdown.Item
              textValue={name}
              className="cursor-default select-none focus:bg-transparent data-[highlighted]:bg-transparent"
            >
              <div className="flex w-full flex-col">
                <div className="flex items-center gap-3 py-1">
                  <Av className="size-10 shrink-0">
                    <AvImg src={user?.avatar ?? undefined} />
                    <AvFb>{initial}</AvFb>
                  </Av>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {sub && <p className="truncate text-xs text-foreground/50">{sub}</p>}
                  </div>
                </div>
                {points > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); router.push(ROUTES.REWARDS); }}
                    className="cursor-pointer mt-2 flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                  >
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    {points.toLocaleString("vi-VN")} điểm
                  </button>
                )}
              </div>
            </Dropdown.Item>
          </Dropdown.Section>

          {/* Navigation */}
          <Dropdown.Section>
            <Dropdown.Item
              textValue={t('my_account')}
              onPress={() => router.push(ROUTES.PROFILE)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <User className="size-4 shrink-0 text-foreground/50" />
                {t('my_account')}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue={t('order_history')}
              onPress={() => router.push(ROUTES.ORDERS)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <FileText className="size-4 shrink-0 text-foreground/50" />
                {t('order_history')}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue={t('group_order_session_title')}
              onPress={() => router.push(ROUTES.GROUP_ORDER_SESSIONS)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <Users className="size-4 shrink-0 text-foreground/50" />
                <span className="flex-1">{t('group_order_session_title')}</span>
                {minMinsLeft !== null && (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-purple-700">
                    {minMinsLeft <= 0
                      ? t("sessions_expired")
                      : minMinsLeft < 60
                        ? t("sessions_badge_mins", { n: minMinsLeft })
                        : t("sessions_badge_hours", { n: Math.floor(minMinsLeft / 60) })}
                  </span>
                )}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue={t('my_vouchers')}
              onPress={() => router.push(ROUTES.VOUCHERS)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <Ticket className="size-4 shrink-0 text-foreground/50" />
                {t('my_vouchers')}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue="Đổi điểm"
              onPress={() => router.push(ROUTES.REWARDS)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <StoreIcon className="size-4 shrink-0 text-foreground/50" />
                {t('redeem_points')}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue={t('shipping_addresses')}
              onPress={() => router.push(ROUTES.ADDRESSES)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <MapPin className="size-4 shrink-0 text-foreground/50" />
                {t('shipping_addresses')}
              </div>
            </Dropdown.Item>
            <Dropdown.Item
              textValue={t('feedback')}
              onPress={() => router.push(ROUTES.FEEDBACK)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-foreground">
                <MessageSquare className="size-4 shrink-0 text-foreground/50" />
                {t('feedback')}
              </div>
            </Dropdown.Item>
          </Dropdown.Section>

          {/* Logout */}
          <Dropdown.Section>
            <Dropdown.Item
              textValue="Đăng xuất"
              onPress={() => {
                clearSession();
                router.push(ROUTES.HOME);
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2.5 py-0.5 text-sm text-red-600">
                <LogOut className="size-4 shrink-0" />
                {t('logout')}
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
};
