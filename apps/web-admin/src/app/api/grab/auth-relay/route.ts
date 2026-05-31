import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Module-level store — fine for single-instance local admin tool
let _store: { cookie: string; capturedAt: number } | null = null;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, text/plain",
};

// Receives cookie string POSTed from the popup's console script.
// Uses text/plain + no-cors to bypass CORS preflight from the grab.com popup.
export async function POST(request: NextRequest) {
  try {
    const cookie = (await request.text()).trim();
    if (!cookie) {
      return new NextResponse("empty", { status: 400, headers: CORS_HEADERS });
    }
    _store = { cookie, capturedAt: Date.now() };
    console.log("[GrabRelay] Received cookie data, length:", cookie.length);
    return new NextResponse("ok", { headers: CORS_HEADERS });
  } catch {
    return new NextResponse("error", { status: 500, headers: CORS_HEADERS });
  }
}

// Polled by the web-admin every second — returns captured data once then clears it.
export async function GET() {
  if (_store && Date.now() - _store.capturedAt < 5 * 60 * 1000) {
    const data = _store;
    _store = null;
    return NextResponse.json(
      { ok: true, cookie: data.cookie },
      { headers: CORS_HEADERS },
    );
  }
  return NextResponse.json({ ok: false, pending: true }, { headers: CORS_HEADERS });
}

// CORS preflight for the no-cors POST from grab.com popup
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
