---
version: 1.0
name: UjCha-design-system
description: A calm, photography-led Vietnamese café marketplace anchored on a near-white canvas and UjCha Forest (#1a3c34), the single brand voltage that carries every primary CTA, active state, price tag, and focus ring. Type runs Geist Sans at modest weights — display sits at 20–28px in weight 600/700 rather than aggressive heavyweight headings; the brand trusts product photography and generous whitespace over typographic muscle. Shape language is softly rounded throughout: cards at 12px radius, XL containers at 24px, hero panels at 32px — no hard corners anywhere except the body grid.

colors:
  # ── Brand ──────────────────────────────────────────────────────────────────
  primary: "#1a3c34"           # UjCha Forest — primary CTA, active state, focus ring, price, links
  primary-hover: "#2d4a43"     # Tertiary green — hover/active overlay on primary surfaces
  primary-active: "#163129"    # Darker press state
  primary-disabled: "#a8c4bc"  # Desaturated mint — disabled CTAs
  sage: "#5a8f7a"              # Sage — secondary actions, badges, hover accents
  sage-light: "#99d6b3"        # Mint — highlight rings, success states, pill accents
  products-forest: "#26634d"   # Product-page active green — slightly brighter than forest

  # ── Hero / CTA surfaces ────────────────────────────────────────────────────
  hero-cta-bg: "#3d7568"       # Warm teal — hero section primary CTA background
  hero-cta-fg: "#ffffff"       # White — text on teal CTA
  on-hero: "#ffffff"           # White — any text laid over dark hero photo

  # ── Warm accents ────────────────────────────────────────────────────────────
  caramel: "#c9a227"           # Caramel/gold — warning, star rating, caramel latte accent
  danger: "#c45c5c"            # Muted red — error states, cancel badges

  # ── Neutrals ────────────────────────────────────────────────────────────────
  canvas: "#ffffff"            # Pure white — default page floor, card surfaces
  surface-soft: "#f7f7f7"      # Footer, subtle section backgrounds
  surface-card: "#ededed"      # Card, chip, and pill surface
  surface-tertiary: "#e4e4e4"  # Heavier neutral — dividers, skeleton loaders
  promo-surface: "#efefef"     # Promo banner background
  ink: "#1a1a1a"               # Near-black — headlines, body, nav links
  muted: "#717171"             # Mid-grey — sub-labels, captions, placeholder
  hairline: "rgba(26,26,26,0.10)"    # Default 1px border
  hairline-strong: "rgba(26,26,26,0.16)"  # Stronger border, focused inputs
  separator: "rgba(26,26,26,0.06)"   # Very light row separators
  scrim: "#000000"             # Modal backdrop (apply at 40–50% opacity)

typography:
  display-xl:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.5px
  display-lg:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  display-md:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  display-sm:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.1px
  title-lg:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  title-md:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  body-lg:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-md:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: 0
  micro-label:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.2em
    textTransform: uppercase
  price:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  button-md:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  button-sm:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  nav-link:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: 0

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px        # --radius: 0.75rem — default card radius
  lg: 16px
  xl: 24px        # --radius-kun-xl: 1.5rem — panels, modals, large cards
  2xl: 32px       # --radius-kun-2xl: 2rem — hero cards, promo panels
  full: 9999px    # pill badges, avatar circles

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 20px
  xl: 24px
  2xl: 32px
  3xl: 48px
  section: 64px   # vertical breathing room between major page sections

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 12px 24px
    height: 44px
    note: "Rounded-full pill. Forest fill, white text. No outline, no shadow — colour alone carries the CTA."

  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.canvas}"
    opacity: 0.92

  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.canvas}"
    cursor: not-allowed

  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.full}"
    padding: 11px 23px
    height: 44px
    border: "1px solid {colors.hairline-strong}"
    note: "White with ink border. Used for 'Cancel', 'Go back', secondary confirmations."

  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button-md}"
    note: "Text-only, no surface. Used for 'View all', 'Show more', modal close labels."

  button-pill-sage:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    note: "Category/filter chip. Neutral surface. Active state: forest fill + white text."

  button-pill-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px

  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 44px
    border: "1px solid {colors.hairline}"
    note: "Slim header h-11 sm:h-12. Logo left, nav links center (Products etc.), user utilities right (search, bell, profile)."

  product-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    shadow: "0 2px 8px -4px rgba(0,0,0,0.08)"
    note: "Photo-first card. Aspect-ratio image with rounded-md clip. Below: name in title-md, category badge, price in forest color."

  product-card-image:
    rounded: "{rounded.md}"
    aspectRatio: "4/3"

  category-card:
    rounded: "{rounded.xl}"
    height: 128px
    note: "Dark gradient overlay card (see PALETTES in Categories.tsx). White text + accent orb. No border."

  hero-card:
    rounded: "{rounded.2xl}"
    note: "Full-bleed photo panel. White text overlay, teal CTA pill. Used in homepage carousel."

  promo-banner:
    backgroundColor: "{colors.promo-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: 32px 48px
    note: "Off-white surface. Ink headline, muted body, black CTA pill. Right side: product photo."

  order-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    border: "1px solid {colors.hairline}"
    shadow: "0 4px 20px -8px rgba(0,0,0,0.10)"
    note: "Order history / detail card. White surface, 24px+ padding, subtle shadow. Status badge uses semantic palette."

  status-badge:
    rounded: "{rounded.full}"
    padding: 4px 12px
    typography: "{typography.button-sm}"
    note: "Semantic per-status: amber(pending), blue(confirmed), purple(preparing), teal(ready), sky(delivering), green(completed), red(cancelled)."

  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
    focusBorder: "2px solid {colors.primary}"
    padding: 12px 16px
    height: 48px
    note: "No glow, no ring — border thickens to 2px forest on focus."

  search-input:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    border: "1px solid {colors.hairline-strong}"
    height: 40px
    padding: 0 16px
    note: "Pill-shaped inline search. Icon left, clear button right when active."

  modal:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    shadow: "0 24px 64px -16px rgba(0,0,0,0.20)"
    padding: 24px
    scrim: "{colors.scrim} at 40% opacity"

  footer:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 48px 0
    note: "Light grey floor — distinct from the white page canvas. 3–4 column link grid collapsing to 2-col on mobile."

  loyalty-qr-card:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: 24px
    note: "Forest-fill QR reward card. White QR code centered, mint accent, white text."
---

## Overview

**UjCha** is a Vietnamese café marketplace with a calm, photography-led identity. The base canvas is **pure white** (`{colors.canvas}` — #ffffff) with near-black ink (`{colors.ink}` — #1a1a1a) for all text, and a single primary voltage of **UjCha Forest** (`{colors.primary}` — #1a3c34) that carries every CTA, active link, price, focus ring, and brand moment. There is no secondary brand color in mainline marketing — **Sage** (`{colors.sage}` — #5a8f7a) and **Mint** (`{colors.sage-light}` — #99d6b3) are supporting tones used as badges, highlights, and hover accents; **Caramel** (`{colors.caramel}` — #c9a227) appears only for ratings, warnings, and latte-themed category palettes.

Type runs **Geist Sans** (`var(--font-geist-sans)`), a clean geometric sans at modest weights — display headlines sit at 600–700 and 20–28px rather than heavy typographic muscle. The brand trusts product photography (matcha, tea, coffee) and whitespace for visual hierarchy; the typeface stays quiet.

Shape language is **soft without being childlike**. Buttons are pill-shaped (`{rounded.full}`), standard cards are 12px (`{rounded.md}`), XL panels and modals use 24px (`{rounded.xl}`), and hero-level cards use 32px (`{rounded.2xl}`). No hard corners appear except the page grid itself.

**Key Characteristics:**
- Single accent: `{colors.primary}` (#1a3c34 — UjCha Forest) on every CTA, active state, price display, and link. Pages are ~90% white + ink with forest moments.
- Supporting tones: Sage and Mint used scarcely for secondary UI. Caramel reserved for ratings and warm-category overlays only.
- Pill CTAs: All primary and secondary buttons use `{rounded.full}`. Filter chips use the same pill shape with neutral-surface default and forest-fill active state.
- Photography-first layout: Product and category cards prioritise the image (4:3 ratio), with minimal meta below. The image carries visual weight, not the type.
- Dark overlay category cards: The category section uses dark gradient cards (forest/espresso/caramel per palette slot) with white text — the only intentionally dark surface outside the hero.
- Container width: `max-w-[72rem]` (~1152px) centred with `px-5` gutters. Tighter than typical SaaS to keep café product grids dense and legible.
- Grid density: 2-col mobile → 3-col md → 4-col lg → 6-col 2xl for product grids. 12 products shown on homepage LP (divisible by 2, 3, 4, 6).

---

## Colors

### Brand
- **UjCha Forest** (`{colors.primary}` — #1a3c34): The single brand color. Used for primary CTA backgrounds, price displays, active nav states, focus rings, and inline links. The matcha forest green that defines the brand's identity.
- **Primary Hover** (`{colors.primary-hover}` — #2d4a43): The pointer-over variant — slightly lighter forest for hover overlays.
- **Primary Active** (`{colors.primary-active}` — #163129): The press/pointer-down variant — darker.
- **Primary Disabled** (`{colors.primary-disabled}` — #a8c4bc): A desaturated mint for disabled CTAs.
- **Sage** (`{colors.sage}` — #5a8f7a): Mid-tone matcha. Used on secondary badges, hover accents, and product-page highlights.
- **Mint** (`{colors.sage-light}` — #99d6b3): Light mint. Used for ring accents, success states, and the loyalty reward pill.
- **Products Forest** (`{colors.products-forest}` — #26634d): Brighter active-green used specifically on the products page filter pills and active states.

### Surface
- **Canvas** (`{colors.canvas}` — #ffffff): The default page floor for all public pages.
- **Surface Soft** (`{colors.surface-soft}` — #f7f7f7): Footer background and subtle section fills.
- **Surface Card** (`{colors.surface-card}` — #ededed): Default chip, pill, and card surface. Used for skeleton loaders.
- **Surface Tertiary** (`{colors.surface-tertiary}` — #e4e4e4): Heavier neutral for dividers and skeleton states.
- **Promo Surface** (`{colors.promo-surface}` — #efefef): Specific to the promo banner component.

### Text
- **Ink** (`{colors.ink}` — #1a1a1a): Near-black for all headlines, body, nav links. Never pure black.
- **Muted** (`{colors.muted}` — #717171): Sub-labels, captions, placeholders, inactive states.

### Borders & Hairlines
- **Hairline** (`{colors.hairline}` — rgba(26,26,26,0.10)): Default 1px border on cards and inputs.
- **Hairline Strong** (`{colors.hairline-strong}` — rgba(26,26,26,0.16)): Focused inputs, stronger dividers.
- **Separator** (`{colors.separator}` — rgba(26,26,26,0.06)): Very light row separators inside cards.

### Semantic
- **Caramel** (`{colors.caramel}` — #c9a227): Warnings, star ratings, caramel category accents. Never used as a brand color.
- **Danger** (`{colors.danger}` — #c45c5c): Error states, cancel badges, destructive actions.

### CTA Surfaces
- **Hero CTA BG** (`{colors.hero-cta-bg}` — #3d7568): Warm teal used for the hero section's primary CTA button. Softer than forest against photo backgrounds.
- **On Hero** (`{colors.on-hero}` — #ffffff): White text used over any dark hero photo overlay.

---

## Typography

**Geist Sans** (`var(--font-geist-sans)`) is the sole typeface. Clean, geometric, optimised for screens. Fallback stack: `ui-sans-serif, system-ui, sans-serif`.

| Token | Size | Weight | Use |
|---|---|---|---|
| `{typography.display-xl}` | 28px / 700 | -0.5px | Page-level hero headline ("Khám phá UjCha") |
| `{typography.display-lg}` | 24px / 600 | -0.3px | Section headlines ("Sản phẩm nổi bật") |
| `{typography.display-md}` | 20px / 600 | -0.2px | Card group titles, modal headers |
| `{typography.display-sm}` | 18px / 600 | -0.1px | Sub-section titles, sidebar headings |
| `{typography.title-lg}` | 16px / 600 | 0 | Card titles, list item primaries |
| `{typography.title-md}` | 15px / 600 | 0 | Product names, secondary card titles |
| `{typography.body-lg}` | 16px / 400 | 0 | Default running text, long descriptions |
| `{typography.body-md}` | 14px / 400 | 0 | Card meta, dates, secondary info |
| `{typography.body-sm}` | 13px / 400 | 0 | Captions, fine print, receipt lines |
| `{typography.caption}` | 12px / 500 | 0 | Input labels, micro-metadata |
| `{typography.micro-label}` | 10px / 700 | 0.2em uppercase | Section eyebrow labels ("DANH MỤC", "SẢN PHẨM") |
| `{typography.price}` | 18px / 700 | -0.3px | Price displays — forest color, tabular-nums |
| `{typography.button-md}` | 15px / 600 | 0 | Primary CTA labels |
| `{typography.button-sm}` | 13px / 600 | 0 | Filter chips, secondary pill labels |
| `{typography.nav-link}` | 14px / 500 | 0 | Header navigation links |

**Principles:** Display weights are deliberately moderate (600–700) — the brand relies on product photography and whitespace for hierarchy, not bold type. The one typographic loud moment is prices in forest color at 18px/700 — matching the Airbnb pattern of making the key trust/decision number the loudest text.

---

## Layout

- **Base unit:** 4px.
- **Spacing tokens:** xxs(2) · xs(4) · sm(8) · md(12) · base(16) · lg(20) · xl(24) · 2xl(32) · 3xl(48) · section(64).
- **Container max-width:** `72rem` (~1152px) centred, `px-5` gutters on mobile, `px-8` on lg+.
- **Section vertical padding:** `py-12 sm:py-16` (48–64px) for LP sections — generous but not airy.
- **Product grid columns:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`.
- **LP featured count:** 12 items (divisible by 2, 3, 4, 6).
- **Card gutter:** `gap-4 sm:gap-5` (16–20px).

---

## Elevation

One shadow tier, used sparingly:
- **Flat (no shadow):** Body, hero, footer, editorial bands — ~90% of surfaces.
- **Card shadow:** `shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)]` — used on order detail cards, modals, and floating dropdowns.
- **Hover lift:** `shadow-xl` applied on card hover via `hover:shadow-xl hover:scale-[1.02]` transition.
- **Modal scrim:** `{colors.scrim}` at 40–50% opacity.

---

## Component Patterns

### Buttons
- **All buttons are pill-shaped** (`rounded-full`). No square or slightly-rounded buttons in the main UI.
- **Primary CTA:** Forest fill, white text, 44px height, `px-6` padding. Use `hover:opacity-90` instead of a separate hover color.
- **Secondary CTA:** White fill, ink border `border border-black/16`, same pill shape.
- **Ghost/Text CTA:** No surface. Forest text. Underline on hover. For "Xem tất cả", "Quay lại".
- **Filter chips:** `rounded-full bg-surface-card text-foreground px-4 py-2 text-xs font-semibold`. Active: `bg-primary text-white`.

### Cards
- Use `rounded-3xl` (`{rounded.xl}`) for order/detail cards, `rounded-2xl` for product cards and modals.
- Always pair with `border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]`.
- Inside padding: `p-5 sm:p-6`.

### Status Badges
Semantic color pairs (bg/text/ring) used consistently across order status, never custom per-component:
- `pending` → amber-50 / amber-700 / amber-200
- `confirmed` → blue-50 / blue-700 / blue-200
- `preparing` → purple-50 / purple-700 / purple-200
- `ready` → teal-50 / teal-700 / teal-200
- `delivering` → sky-50 / sky-700 / sky-200
- `completed` → green-50 / green-700 / green-200
- `cancelled` → red-50 / red-600 / red-200

### Micro-labels / Eyebrow Text
All section eyebrows follow this pattern:
```
text-[10px] font-semibold uppercase tracking-[0.2em] text-muted
```
Never bold section headings alone — always pair with a quiet eyebrow label above.

### Section Structure (Landing Page)
Every LP section uses `RevealSection` with `px-4 py-12 sm:px-6 sm:py-16`. All content inside is wrapped in `<div className="container mx-auto">`. Stagger `motion.div` reveals at `delay: index * 0.07`.

---

## Responsive Behavior

| Breakpoint | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Single-column nav collapses to hamburger; product grid 2-col; search expands fullscreen overlay; hero carousel full-bleed with thin radius. |
| sm | 640–768px | Product grid 3-col; category horizontal scroll becomes 3-col grid. |
| md | 768–1024px | Full desktop nav; search inline; product grid 4-col. |
| lg | 1024–1280px | Container max-width kicks in; product grid stays 4-col; sidebar layouts available. |
| xl | 1280–1536px | Product grid 5-col. |
| 2xl | ≥ 1536px | Product grid 6-col; image sizes `(min-width: 1536px) 15vw`. |

### Touch Targets
- Primary CTAs minimum 44×44px (meets WCAG AA).
- Filter chips minimum 36px height.
- Card tap targets cover the full card surface via `<button>` or `<Link>` wrap.

---

## Writing Style (Component Code)

When writing components for this project:
1. **Always use CSS variable tokens** (`text-kun-primary`, `bg-kun-mint`, `text-muted`, `border-black/6`) over arbitrary hex values.
2. **Pill CTAs** — all interactive buttons use `rounded-full`. No `rounded-lg` on buttons.
3. **Cards** — `rounded-3xl border border-black/6 bg-white` is the standard card shell.
4. **Eyebrow labels** — every section head should have a `text-[10px] font-semibold uppercase tracking-[0.2em] text-muted` line above the h2.
5. **Price display** — always `font-bold tabular-nums text-kun-products-forest` or `text-kun-primary`.
6. **Motion** — use `motion.div` with `initial={{ opacity: 0, y: 14 }}` + `whileInView` + `viewport={{ once: true, margin: "-48px" }}` + staggered `delay: index * 0.07` for list items.
7. **Images** — always include `fill` + `object-cover` + correct `sizes` prop. Never hard-code `width`/`height` on Next.js `<Image>` unless it's a fixed-size icon.
8. **No comments** explaining what code does — only add a comment when the WHY is non-obvious.
