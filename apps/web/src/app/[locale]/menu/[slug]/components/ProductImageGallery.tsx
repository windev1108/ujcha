"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  images: string[];
  name: string;
  placeholderBg?: string;
};

export function ProductImageGallery({ images, name, placeholderBg = "#1a3c34" }: Props) {
  const t = useTranslations();
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);

  const hasImages = images.length > 0;
  const currentImage = images[active] ?? null;

  function go(next: number) {
    setDirection(next > active ? 1 : -1);
    setActive(next);
  }

  function prev() { go((active - 1 + images.length) % images.length); }
  function next() { go((active + 1) % images.length); }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — portrait 3:4 */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl ring-1 ring-black/[0.08] shadow-[0_16px_60px_-16px_rgba(0,0,0,0.22)]"
        style={{ backgroundColor: hasImages ? undefined : placeholderBg }}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={active}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 48, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -48, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            {currentImage ? (
              <Image
                src={currentImage}
                alt={`${name} - ảnh ${active + 1}`}
                fill
                priority={active === 0}
                unoptimized
                className="object-cover"
                sizes="(min-width: 1280px) 400px, (min-width: 1024px) 360px, 100vw"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: placeholderBg }}
              >
                <span className="select-none text-8xl font-black text-white/10">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={t("scroll_left")}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow ring-1 ring-black/[0.06] transition hover:bg-white"
            >
              <ChevronLeft className="size-3.5 text-foreground" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t("scroll_right")}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow ring-1 ring-black/[0.06] transition hover:bg-white"
            >
              <ChevronRight className="size-3.5 text-foreground" />
            </button>

            <div className="absolute bottom-3 right-3 rounded-full bg-black/45 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white/90">
              {active + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => go(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              className={`relative aspect-[3/4] w-[72px] shrink-0 overflow-hidden rounded-xl transition-all ${
                i === active
                  ? "ring-2 ring-kun-products-forest ring-offset-1"
                  : "opacity-55 ring-1 ring-black/[0.07] hover:opacity-90"
              }`}
            >
              <Image
                src={img}
                alt={`${name} - thu nhỏ ${i + 1}`}
                fill
                unoptimized
                className="object-cover"
                sizes="72px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
