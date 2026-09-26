// web/src/constants/chat-stickers.ts
export interface ChatSticker {
  id: string;
  url: string;
  alt: string;
}

function altFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const filename = pathname.split("/").pop() ?? "sticker";
    const base = filename.replace(/\.[^/.]+$/, "");
    return base.replace(/[-_]+/g, " ").trim() || "Sticker";
  } catch {
    return "Sticker";
  }
}

function parseStickerUrls(raw: string | undefined): ChatSticker[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url, idx) => ({ id: `sticker-${idx}`, url, alt: altFromUrl(url) }));
}

// Danh sách URL sticker lấy từ ENV — set NEXT_PUBLIC_CHAT_STICKER_URLS
// (comma-separated) trong .env. Không còn whitelist ở backend, vì vậy nếu
// bạn đổi danh sách này, chỉ cần sửa ENV, không cần deploy backend.
export const CHAT_STICKERS: ChatSticker[] = parseStickerUrls(
  process.env.NEXT_PUBLIC_CHAT_STICKER_URLS,
);