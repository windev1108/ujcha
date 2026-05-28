"use client";

import { Button, Card } from "@heroui/react";
import Image from "next/image";

type Props = {
  title: string;
  description: string;
  price: string;
  image: string;
  actionLabel?: string;
};

export function ProductItemCard({
  title,
  description,
  price,
  image,
  actionLabel = "Add item",
}: Props) {
  return (
    <Card className="rounded-3xl border border-black/6 bg-white/70 p-4">
      <div className="flex flex-row items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
          <Image src={image} alt={title} fill className="object-cover" sizes="80px" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-foreground/70">{description}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-semibold text-kun-products-forest">{price}</span>
            <Button
              variant="ghost"
              className="rounded-full text-xs font-semibold uppercase tracking-wider"
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
