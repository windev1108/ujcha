"use client";

import { Button, Tooltip } from "@heroui/react";
import { ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartQuery } from "@/services/cart/hooks";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/hooks";
import { useCartStore } from "@/store/cart-store";

export const CartSection = ({ isPastHero }: { isPastHero: boolean }) => {
  const t = useTranslations();
  const { isLoggedIn } = useAuth();
  const { data: cart } = useCartQuery();
  const localItems = useCartStore((s) => s.items);
  const count = isLoggedIn ? (cart?.items?.length ?? 0) : localItems.length;

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Link href={ROUTES.CART} aria-label={t("cart")}>
          <Button
            isIconOnly
            variant="ghost"
            className={`flex size-9 items-center justify-center rounded-full transition ${isPastHero ? "text-foreground hover:bg-black/6" : "text-white hover:bg-black/6"}`}>
            <ShoppingCartIcon className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-kun-primary text-[10px] font-bold leading-none text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Tooltip.Arrow />
        {t("cart")}
      </Tooltip.Content>
    </Tooltip>
  );
};
