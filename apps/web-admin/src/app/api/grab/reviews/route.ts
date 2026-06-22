import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GRAB_REVIEWS_URL = "https://api.grab.com/food/merchant/v1/feedback/reviews";

export async function POST(request: NextRequest) {
  let authCookie: string;
  let merchantId: string | undefined;
  let pageToken: string | undefined;
  let pageSize: number;

  try {
    const body = (await request.json()) as {
      authCookie?: string;
      merchantId?: string;
      pageToken?: string;
      pageSize?: number;
    };
    if (!body.authCookie?.trim()) {
      return NextResponse.json({ error: "Missing authCookie" }, { status: 400 });
    }
    authCookie = body.authCookie.trim();
    merchantId = body.merchantId?.trim() || undefined;
    pageToken  = body.pageToken ?? "";
    pageSize   = body.pageSize ?? 50;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!merchantId) {
    const m = authCookie.match(/[;,\s]?merchantid=([^;,\s]+)/i);
    if (m) merchantId = m[1];
  }

  const headers: Record<string, string> = {
    Cookie: authCookie,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "vi",
    Origin: "https://merchant.grab.com",
    Referer: "https://merchant.grab.com/",
    requestsource: "troyPortal",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };
  if (merchantId) headers["merchantid"] = merchantId;

  try {
    const res = await fetch(GRAB_REVIEWS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ pageToken, pageSize }),
    });

    console.log("[GrabReviews] status:", res.status);

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Cookie không hợp lệ hoặc phiên đã hết hạn — đăng nhập lại" },
        { status: 401 },
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[GrabReviews] error body:", text.slice(0, 300));
      return NextResponse.json({ error: `GrabFood API lỗi: HTTP ${res.status}` }, { status: 502 });
    }

    const data = await res.json() as Record<string, unknown>;

    // Discover which key holds the review list (Grab uses different keys across versions)
    const REVIEW_LIST_KEYS = ["reviews", "feedbackList", "reviewList", "data", "items", "list"];
    const listKey = REVIEW_LIST_KEYS.find((k) => Array.isArray(data[k]))
      ?? Object.keys(data).find((k) => Array.isArray(data[k]));
    const rawList = listKey ? (data[listKey] as unknown[]) : [];

    // Discover pagination token key
    const TOKEN_KEYS = ["nextToken", "nextPageToken", "pageToken", "cursor", "next"];
    const tokenKey = TOKEN_KEYS.find((k) => typeof data[k] === "string" && data[k]);
    const nextToken = tokenKey ? (data[tokenKey] as string) : undefined;

    console.log("[GrabReviews] list key:", listKey, "count:", rawList.length, "nextToken key:", tokenKey);
    if (rawList.length > 0) {
      const first = rawList[0] as Record<string, unknown>;
      console.log("[GrabReviews] first review keys:", Object.keys(first));
      console.log("[GrabReviews] first review orderedItems:", first.orderedItems);
    }

    return NextResponse.json({ reviews: rawList, nextToken });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
