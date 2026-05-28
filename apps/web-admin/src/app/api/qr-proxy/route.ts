import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOST = "qr.sepay.vn";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return new NextResponse("Disallowed host", { status: 403 });
  }

  try {
    const upstream = await fetch(raw, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) {
      return new NextResponse("Upstream error", { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
