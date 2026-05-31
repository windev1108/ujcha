import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GRAB_MENU_URL = "https://api.grab.com/food/merchant/v2/menu";

export async function POST(request: NextRequest) {
  let authCookie: string;
  let merchantId: string | undefined;
  let merchantGroupId: string | undefined;

  try {
    const body = (await request.json()) as {
      authCookie?: string;
      merchantId?: string;
      merchantGroupId?: string;
    };
    if (!body.authCookie?.trim()) {
      return NextResponse.json({ error: "Missing authCookie" }, { status: 400 });
    }
    authCookie     = body.authCookie.trim();
    merchantId     = body.merchantId?.trim() || undefined;
    merchantGroupId = body.merchantGroupId?.trim() || undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Extract merchantid / merchantgroupid from the cookie string if not supplied
  if (!merchantId) {
    const m = authCookie.match(/[;,\s]?merchantid=([^;,\s]+)/i);
    if (m) merchantId = m[1];
  }

  const headers: Record<string, string> = {
    Cookie: authCookie,
    Accept: "application/json",
    "Accept-Language": "vi",
    Origin: "https://merchant.grab.com",
    Referer: "https://merchant.grab.com/",
    requestsource: "troyPortal",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };
  if (merchantId)      headers["merchantid"]      = merchantId;
  if (merchantGroupId) headers["merchantgroupid"] = merchantGroupId;

  try {
    const res = await fetch(GRAB_MENU_URL, { method: "GET", headers });
    console.log("[GrabMenu] status:", res.status, "headers sent:", Object.keys(headers).join(", "));

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Cookie không hợp lệ hoặc phiên đã hết hạn — đăng nhập lại" },
        { status: 401 },
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[GrabMenu] error body:", text.slice(0, 300));
      return NextResponse.json({ error: `GrabFood API lỗi: HTTP ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    console.log("[GrabMenu] response keys:", Object.keys(data as object).join(", "));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
