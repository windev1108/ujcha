/** Chuyển markdown thuần (bài cũ) sang HTML đơn giản để mở trong TipTap. */
export function htmlFromMarkdownFallback(md: string): string {
  const t = md.trim();
  if (!t) return "<p></p>";
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  return t
    .split(/\n\n+/)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export function hasMeaningfulHtmlContent(html: string): boolean {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}
