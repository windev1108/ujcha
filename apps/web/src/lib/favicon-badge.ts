export function applyFaviconBadge(hasBadge: boolean): void {
  if (typeof window === "undefined") return;

  const href = hasBadge ? "/favicon-dot.png" : "/favicon.png";

  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );

  if (links.length > 0) {
    links.forEach((el) => { el.href = href; });
    return;
  }

  // Fallback: no existing favicon links — create one
  const el = document.createElement("link");
  el.rel = "icon";
  el.type = "image/png";
  el.href = href;
  document.head.appendChild(el);
}
