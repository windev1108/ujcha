"use client";

import { useEffect, useState } from "react";

/**
 * useHeaderTheme
 * ─────────────────────────────────────────────────────────────────────────
 * Flexible, per-page header theming.
 *
 * Any section on a page can opt in to "light header" mode by adding the
 * attribute `data-header-theme="light"` (e.g. HeroSection). While that
 * element still intersects the header's observation line near the top of
 * the viewport, the header should render in its LIGHT variant — white
 * text/icons suitable for sitting on top of a dark/colorful hero.
 *
 * Once the user scrolls past all such elements (or if the page has none at
 * all, e.g. Checkout, Profile), the header falls back to its DARK variant
 * — solid background, dark text — which is the safe default for plain
 * light-background pages.
 *
 * This intentionally does NOT depend on knowing the hero's height up
 * front: IntersectionObserver re-evaluates on real layout/scroll, so it
 * stays correct for 100vh heroes, 60vh heroes, dynamically-sized content,
 * or pages with multiple stacked "light" sections.
 *
 * Returns:
 *   - theme: "light" | "dark" — current header theme
 *   - isPastHero: boolean — true once no [data-header-theme="light"]
 *     element is intersecting (equivalent to theme === "dark", kept as a
 *     separate boolean for readability at call sites and for non-color
 *     conditionals, e.g. adding a backdrop-blur background to the header).
 *
 * Usage on any section that should show a light header while in view:
 *   <section data-header-theme="light"> ... </section>
 *
 * Usage in AppHeader:
 *   const { isPastHero } = useHeaderTheme();
 */

const HEADER_HEIGHT_PX = 64; // keep in sync with the header's actual height

export function useHeaderTheme() {
    const [isPastHero, setIsPastHero] = useState(true);

    useEffect(() => {
        const targets = Array.from(
            document.querySelectorAll<HTMLElement>('[data-header-theme="light"]')
        );

        // No light-themed section on this page at all → header stays dark.
        if (targets.length === 0) {
            setIsPastHero(true);
            return;
        }

        // A target exists on this page, so start "inside hero" optimistically
        // to avoid a flash of the dark header before the first observer
        // callback fires (most pages with a light section render it at top).
        setIsPastHero(false);

        function recompute() {
            const anyIntersecting = targets.some((t) => {
                const rect = t.getBoundingClientRect();
                // "Still relevant to the header" = any part of this element is
                // below the header's bottom edge and above the bottom of the
                // viewport — i.e. it hasn't fully scrolled out from under the
                // header yet.
                return rect.bottom > HEADER_HEIGHT_PX && rect.top < window.innerHeight;
            });
            setIsPastHero(!anyIntersecting);
        }

        const observer = new IntersectionObserver(
            () => recompute(),
            {
                root: null,
                rootMargin: `-${HEADER_HEIGHT_PX}px 0px 0px 0px`,
                threshold: 0,
            }
        );

        targets.forEach((el) => observer.observe(el));

        // IntersectionObserver alone can miss the very first paint state on
        // some browsers/layouts; do one manual pass too.
        recompute();

        window.addEventListener("resize", recompute);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", recompute);
        };
    }, []);

    return {
        theme: isPastHero ? ("dark" as const) : ("light" as const),
        isPastHero,
    };
}