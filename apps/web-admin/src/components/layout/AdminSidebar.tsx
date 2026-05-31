"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Armchair,
  BookOpen,
  ClipboardCheck,
  Coins,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessageSquareDot,
  Monitor,
  Package,
  Printer,
  Receipt,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users2,
  UserCog,
  Layers,
  Volume2,
  MapPin,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { useAuthStore } from "@/store/auth-store";
import type { Permission } from "@/lib/permissions";

import {
  Avatar,
  Button,
  Drawer,
  Text,
  useMediaQuery,
  type UseOverlayStateReturn,
} from "@heroui/react";
import { ROUTES } from "@/lib/routes";
import { KunLogo } from "../common/kun-logo";

type NavItem = {
  href: string | null;
  label: string;
  icon: LucideIcon;
  /** Required permission for staff to see this item. Undefined = always visible. */
  permission?: Permission;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { href: ROUTES.DASHBOARD, label: "Tổng quan", icon: LayoutDashboard, permission: "dashboard" },
  { href: ROUTES.HRM, label: "Nhân sự (HRM)", icon: Users2, permission: "hrm" },
  { href: ROUTES.USERS, label: "Khách hàng", icon: UserCog, permission: "users" },
  { href: ROUTES.ATTENDANCE, label: "Chấm công", icon: ClipboardCheck },
  { href: ROUTES.ORDERS, label: "Đơn hàng", icon: ShoppingCart, permission: "orders" },
  { href: ROUTES.CATEGORIES, label: "Danh mục", icon: Layers, permission: "categories" },
  { href: ROUTES.PAYMENT_CONFIG, label: "Thanh toán", icon: CreditCard, permission: "payment" },
  { href: ROUTES.PRINTER, label: "Máy in", icon: Printer, permission: "printer" },
  { href: ROUTES.PRODUCTS, label: "Sản phẩm", icon: Package, permission: "products" },
  { href: ROUTES.TABLES, label: "Bàn", icon: Armchair, permission: "tables" },
  { href: ROUTES.SHIPPERS, label: "Shippers", icon: Truck, permission: "shippers" },
  { href: ROUTES.VOUCHERS, label: "Vouchers", icon: TicketPercent, permission: "vouchers" },
  { href: ROUTES.POINTS, label: "Điểm UjCha", icon: Coins, permission: "points" },
  { href: ROUTES.TAXES, label: "Quản lý thuế", icon: Receipt, permission: "taxes" },
  { href: ROUTES.REFERRALS, label: "Giới thiệu", icon: Users2, permission: "referrals" },
  { href: ROUTES.GROUP_ORDERS, label: "Đơn nhóm", icon: UsersRound, permission: "orders" },
  { href: ROUTES.POSTS, label: "Bài viết", icon: BookOpen, permission: "posts" },
  { href: ROUTES.VOICER, label: "Giọng đọc TTS", icon: Volume2, permission: "voicer" },
  { href: ROUTES.FEEDBACK, label: "Phản hồi KH", icon: MessageSquare, permission: "feedback" },
  { href: ROUTES.POS_RELEASE, label: "Cập nhật POS", icon: Monitor },
  { href: ROUTES.SMS, label: "Nhật ký SMS", icon: MessageSquareDot, permission: "dashboard" },
  { href: ROUTES.SHIPPING, label: "Phí vận chuyển", icon: MapPin, permission: "payment" },
];

function initialsFromName(nameOrPhone: string | null | undefined) {
  if (!nameOrPhone) return "AD";
  return nameOrPhone.replace(/\s+/g, "").slice(0, 2).toUpperCase();
}

type SidebarPanelProps = {
  pathname: string;
  onNavigate?: () => void;
};

function SidebarNavPanel({ pathname, onNavigate }: SidebarPanelProps) {
  const admin = useAuthStore((s) => s.admin);

  const displayName = admin?.name?.split(" ")[0] ?? admin?.phone ?? "Admin";
  const roleLabel =
    admin?.role === "super_admin"
      ? "Super Admin"
      : admin?.role === "staff"
        ? "Staff"
        : "Admin";

  const isSuperAdmin = admin?.role === "super_admin";
  const staffPermissions = admin?.permissions ?? [];

  const navItems = ALL_NAV_ITEMS.filter((item) => {
    // Super admin sees everything
    if (isSuperAdmin) return true;
    // Attendance has no permission requirement — always visible to staff
    if (!item.permission) return true;
    return staffPermissions.includes(item.permission);
  });

  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = () => {
    clearSession();
    onNavigate?.();
    router.push(ROUTES.LOGIN);
  };

  return (
    <>
      <Link
        href="/"
        className="mb-8 flex flex-col gap-1 px-2 outline-offset-4 items-center"
        onClick={onNavigate}
      >
        <KunLogo size="md" className="h-10 w-52 object-contain" />
      </Link>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto"
        aria-label="Admin"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/" || pathname === ""
              : href != null &&
              (pathname === href || pathname.startsWith(`${href}/`));

          const itemClass = `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${active
            ? "bg-[color-mix(in_oklab,#71b394_16%,transparent)] text-[#1a3c34]"
            : href
              ? "text-foreground/70 hover:bg-black/[0.04] hover:text-foreground"
              : "cursor-not-allowed text-foreground/45"
            }`;

          const iconClass = `size-4.5 shrink-0 ${active
            ? "text-[#1a3c34]"
            : href
              ? "text-foreground/50"
              : "text-foreground/35"
            }`;

          if (href) {
            return (
              <Link
                key={label}
                href={href}
                className={itemClass}
                onClick={onNavigate}
              >
                <Icon className={iconClass} aria-hidden />
                {label}
              </Link>
            );
          }

          return (
            <span key={label} className={itemClass} title="Sắp có">
              <Icon className={iconClass} aria-hidden />
              {label}
            </span>
          );
        })}
      </nav>

      <div className="mt-4 shrink-0 space-y-3 border-t border-black/6 pt-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[#f9fafb] p-3 ring-1 ring-black/4">
          <Avatar className="shrink-0" size="sm" {...({} as any)}>
            <Avatar.Fallback className="text-xs font-bold" {...({} as any)}>
              {initialsFromName(admin?.name ?? admin?.phone)}
            </Avatar.Fallback>
          </Avatar>
          <div className="min-w-0 flex flex-1 flex-col gap-0.5">
            <Text className="truncate text-sm font-semibold capitalize text-foreground">
              {displayName}
            </Text>
            <Text className="truncate text-xs text-muted">{roleLabel}</Text>
          </div>
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="ghost"
            className="justify-start gap-2 rounded-2xl text-foreground/80 hover:bg-red-50 hover:text-red-700"
            onPress={handleLogout}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar({
  mobileNav,
}: {
  mobileNav: UseOverlayStateReturn;
}) {
  const pathname = usePathname();
  const isLg = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    mobileNav.close();
  }, [pathname, mobileNav.close]);

  useEffect(() => {
    if (isLg) mobileNav.close();
  }, [isLg, mobileNav.close]);

  return (
    <>
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r border-black/6 bg-white px-4 py-6 lg:flex">
        <SidebarNavPanel pathname={pathname} />
      </aside>

      <div className="lg:hidden">
        <Drawer.Root state={mobileNav}>
          <Drawer.Trigger className="sr-only">
            Mở menu điều hướng
          </Drawer.Trigger>
          <Drawer.Backdrop variant="opaque" isDismissable>
            <Drawer.Content
              placement="left"
              className="w-[min(100vw,16rem)] max-w-[min(100vw,16rem)] border-r border-black/6 bg-white shadow-xl"
            >
              <Drawer.Dialog
                id="admin-mobile-drawer"
                className="flex h-dvh max-h-dvh flex-col outline-none"
              >
                <Drawer.Header className="shrink-0 border-b border-black/6 px-4 py-2">
                  <div className="flex w-full items-center justify-between gap-2">
                    <Drawer.Heading className="text-base font-semibold text-foreground">
                      Menu
                    </Drawer.Heading>
                    <Drawer.CloseTrigger aria-label="Đóng menu" />
                  </div>
                </Drawer.Header>
                <Drawer.Body className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
                  <SidebarNavPanel
                    pathname={pathname}
                    onNavigate={() => mobileNav.close()}
                  />
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer.Root>
      </div>
    </>
  );
}
