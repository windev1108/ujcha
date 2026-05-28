"use client";

import { Button, Tooltip } from "@heroui/react";
import { ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCartQuery } from "@/services/cart/hooks";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/hooks";

export const CartSection = () => {
  const t = useTranslations();
  const { isLoggedIn } = useAuth();
  const { data: cart } = useCartQuery();
  const count = isLoggedIn ? (cart?.items?.length ?? 0) : 0;

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Link href={ROUTES.CART} aria-label={t("cart")}>
          <Button
            isIconOnly
            variant="ghost"
            className="relative text-foreground"
          >
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
