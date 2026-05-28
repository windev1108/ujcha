"use client";

import { Badge, Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatVnd } from "./quick-order-data";
import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { useLocalizedHref } from "../../../../i18n/use-localized-href";

type Props = {
    itemCount: number;
    total: number;
};

export function QuickOrderFloatingBar({ itemCount, total }: Props) {
    const router = useRouter();
    const { route } = useLocalizedHref();
    const visible = itemCount > 0;

    return (
        <AnimatePresence>
            {visible ? (
                <motion.div
                    key="bar"
                    initial={{ y: 110, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 110, opacity: 0 }}
                    transition={{ ...revealTransition, ease: easeOutSmooth }}
                    className="fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 sm:bottom-7 sm:max-w-2xl lg:max-w-3xl"
                >
                    <div className="flex items-center gap-4 rounded-full border border-black/[0.07] bg-white px-5 py-3.5 shadow-[0_20px_56px_-12px_rgba(0,0,0,0.28)] sm:gap-6 sm:px-8 sm:py-4">
                        <div className="relative shrink-0">
                            <div className="flex size-12 items-center justify-center rounded-full bg-kun-mint/35 text-kun-products-forest ring-1 ring-kun-products-forest/15 sm:size-[52px]">
                                <ShoppingBag className="size-6" strokeWidth={1.85} aria-hidden />
                            </div>
                            <Badge
                                color="danger"
                                variant="soft"
                                size="sm"
                                className="absolute -right-0.5 -top-0.5 min-w-5 justify-center rounded-full border-2 border-white bg-red-500 px-1 py-0 text-[10px] font-bold text-white"
                            >
                                {itemCount > 99 ? "99+" : itemCount}
                            </Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45 sm:text-[11px]">
                                Đơn hàng của bạn
                            </p>
                            <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
                                {formatVnd(total)}
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            className="h-12 shrink-0 rounded-full bg-kun-products-forest px-6 text-sm font-bold text-white shadow-[0_4px_20px_-6px_rgba(38,99,77,0.65)] hover:opacity-95 sm:h-14 sm:px-10 sm:text-base"
                            onPress={() => router.push(route("CHECKOUT"))}
                        >
                            Thanh toán
                        </Button>
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
