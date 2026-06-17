"use client";

import { ClipboardList } from "lucide-react";
import { Dropdown } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/hooks";
import { useGuestOrders } from "@/hooks/useGuestOrders";
import { ROUTES } from "@/lib/routes";

const TYPE_LABEL: Record<string, string> = {
  delivery: "Giao hàng",
  pickup: "Mang về",
  table: "Tại bàn",
};

function fmtTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function GuestOrdersDropdown({ onNavigate }: { onNavigate?: () => void } = {}) {
  const t = useTranslations();
  const { isLoggedIn } = useAuth();
  const [guestOrders] = useGuestOrders();
  const router = useRouter();

  if (isLoggedIn || guestOrders.length === 0) return null;

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t("guest_orders_eyebrow")}
        className="relative flex size-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#1a3c34]/40"
      >
        <div className="flex size-9 items-center justify-center rounded-full text-foreground/60 transition hover:bg-black/8">
          <ClipboardList className="size-4.5" />
        </div>
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#1a3c34] text-[9px] font-bold text-white">
          {guestOrders.length > 9 ? "9+" : guestOrders.length}
        </span>
      </Dropdown.Trigger>

      <Dropdown.Popover className="w-72 rounded-2xl max-sm:w-[calc(100vw-2rem)]">
        <Dropdown.Menu>
          {/* Fixed eyebrow header */}
          <Dropdown.Section>
            <Dropdown.Item
              textValue={t("guest_orders_eyebrow")}
              className="cursor-default select-none focus:bg-transparent data-[highlighted]:bg-transparent"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("guest_orders_eyebrow")}
              </p>
            </Dropdown.Item>
          </Dropdown.Section>

          {/* Scrollable orders list */}
          <Dropdown.Section className="max-h-[300px] overflow-y-auto">
            {guestOrders.map((o) => (
              <Dropdown.Item
                key={o.paymentCode}
                textValue={o.paymentCode}
                onPress={() => { onNavigate?.(); router.push(ROUTES.ORDER_DETAIL(o.paymentCode)); }}
                className="cursor-pointer"
              >
                <div className="flex w-full items-center gap-3 py-0.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3c34]/8">
                    <ClipboardList className="size-3.5 text-[#1a3c34]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold tracking-tight text-foreground">
                      #{o.paymentCode}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {TYPE_LABEL[o.type] ?? o.type}
                      <span className="mx-1 opacity-40">·</span>
                      {new Intl.NumberFormat("vi-VN").format(Math.round(o.totalAmount))}đ
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted/60">{fmtTime(o.createdAt)}</p>
                </div>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
