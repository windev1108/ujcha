import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { execSync } from "child_process";
import puppeteer, { type Browser } from "puppeteer-core";

export const runtime = "nodejs";

// ─── Same login URL as POS ────────────────────────────────────────────────────
const GRAB_LOGIN_URL =
  "https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal";

const GRAB_COOKIE_URLS = [
  "https://api.grab.com",
  "https://merchant.grab.com",
  "https://portal.grab.com",
  "https://grabid.grab.com",
  "https://weblogin.grab.com",
];

const SKIP_PREFIXES = ["_ga", "_gid", "_fbp", "_fb", "_dd", "_hp2", "_gcl"];

// ─── Module-level session store (same as POS in-memory state) ────────────────
type SessionStatus = "pending" | "done" | "error";
interface Session {
  status: SessionStatus;
  cookie?: string;
  merchantId?: string;
  merchantGroupId?: string;
  error?: string;
  createdAt: number;
}
const sessions = new Map<string, Session>();

function cleanSessions() {
  const now = Date.now();
  for (const [id, s] of sessions)
    if (now - s.createdAt > 10 * 60 * 1000) sessions.delete(id);
}

function findChrome(): string {
  const local = process.env["LOCALAPPDATA"] ?? "";
  const pf   = process.env["PROGRAMFILES"]      ?? "C:\\Program Files";
  const pf86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";

  const candidates = [
    // Windows
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
    `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${pf}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/local/bin/chromium",
    "/snap/bin/chromium",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  for (const p of candidates) if (p && existsSync(p)) return p;

  // Fallback: where (Windows) / which (Unix)
  try {
    const cmd =
      process.platform === "win32"
        ? "where chrome.exe"
        : "which google-chrome 2>/dev/null || which chromium-browser 2>/dev/null || which chromium 2>/dev/null";
    const found = execSync(cmd, { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim()
      .split("\n")[0]
      ?.trim();
    if (found && existsSync(found)) return found;
  } catch { /* not found via PATH */ }

  throw new Error(
    "Không tìm thấy Chrome/Edge. Vui lòng cài đặt Google Chrome.",
  );
}

function buttonScript(count: number): string {
  const label =
    count > 0
      ? `✓ Đã bắt ${count} cookie — Xác nhận lấy session`
      : "✓ Xác nhận đã đăng nhập — Lấy session";
  return `(function(){
    var btn=document.getElementById('__kun_grab_btn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='__kun_grab_btn';
      btn.style.cssText='position:fixed;bottom:20px;right:20px;z-index:999999;background:#00b14f;color:white;border:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
      btn.onclick=function(){btn.textContent='Đang lấy...';btn.disabled=true;window.__kunGrabCapture=true;};
      document.body.appendChild(btn);
    }
    btn.textContent=${JSON.stringify(label)};
  })()`;
}

// Mirrors the POS grab:webLogin IPC handler — runs in Node.js, opens real Chrome
async function runSession(sessionId: string) {
  let browser: Browser | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;

  try {
    browser = await puppeteer.launch({
      executablePath: findChrome(),
      headless: false,
      defaultViewport: null,
      args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
    });

    const [page] = await browser.pages();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Inject green button on every merchant.grab.com navigation
    page.on("framenavigated", async (frame) => {
      if (frame !== page.mainFrame()) return;
      try {
        if (!frame.url().includes("merchant.grab.com")) return;
        const cookies = await page.cookies(...GRAB_COOKIE_URLS);
        const count = cookies.filter(
          (c) => !SKIP_PREFIXES.some((p) => c.name.startsWith(p)),
        ).length;
        await frame.evaluate(buttonScript(count));
      } catch { /* page still loading */ }
    });

    await page.goto(GRAB_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Poll every second — same as POS setInterval
    poll = setInterval(async () => {
      if (sessions.get(sessionId)?.status !== "pending") {
        clearInterval(poll!);
        return;
      }
      try {
        const clicked = await page.evaluate(
          () => (window as { __kunGrabCapture?: boolean }).__kunGrabCapture === true,
        );

        if (!clicked) {
          // Refresh button count
          const cookies = await page.cookies(...GRAB_COOKIE_URLS);
          const count = cookies.filter(
            (c) => !SKIP_PREFIXES.some((p) => c.name.startsWith(p)),
          ).length;
          await page.evaluate(buttonScript(count)).catch(() => null);
          return;
        }

        clearInterval(poll!);

        // Collect ALL cookies (including HttpOnly) via Puppeteer CDP
        const all = await page.cookies(...GRAB_COOKIE_URLS);
        const auth = all.filter(
          (c) => !SKIP_PREFIXES.some((p) => c.name.startsWith(p)),
        );
        const cookieStr = auth.map((c) => `${c.name}=${c.value}`).join("; ");

        // Extract merchantid / merchantgroupid from the current URL or page
        let merchantId = "";
        let merchantGroupId = "";
        try {
          const currentUrl = page.url();
          const u = new URL(currentUrl);
          merchantId      = u.searchParams.get("merchantId")      ?? u.searchParams.get("merchantid")      ?? "";
          merchantGroupId = u.searchParams.get("merchantGroupId") ?? u.searchParams.get("merchantgroupid") ?? "";
        } catch { /* ignore */ }
        // Also check if portal injected these into window state
        try {
          const state = await page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>;
            const mid = (win["merchantID"] ?? win["merchantId"] ?? win["MERCHANT_ID"] ?? "") as string;
            const gid = (win["merchantGroupID"] ?? win["merchantGroupId"] ?? "") as string;
            return { mid, gid };
          });
          if (!merchantId && state.mid)      merchantId      = state.mid;
          if (!merchantGroupId && state.gid) merchantGroupId = state.gid;
        } catch { /* ignore */ }

        sessions.set(sessionId, {
          status: "done",
          cookie: cookieStr,
          merchantId:      merchantId      || undefined,
          merchantGroupId: merchantGroupId || undefined,
          createdAt: sessions.get(sessionId)!.createdAt,
        });

        await browser!.close();
      } catch { /* page navigating, keep polling */ }
    }, 1000);

    browser.on("disconnected", () => {
      clearInterval(poll!);
      if (sessions.get(sessionId)?.status === "pending") {
        sessions.set(sessionId, {
          ...(sessions.get(sessionId)!),
          status: "error",
          error: "Đã đóng cửa sổ trình duyệt",
        });
      }
    });
  } catch (err) {
    clearInterval(poll!);
    await browser?.close().catch(() => null);
    sessions.set(sessionId, {
      ...(sessions.get(sessionId) ?? { createdAt: Date.now() }),
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── POST /api/grab/weblogin — start session, return sessionId immediately ───
export async function POST() {
  cleanSessions();
  const sessionId = randomUUID();
  sessions.set(sessionId, { status: "pending", createdAt: Date.now() });
  void runSession(sessionId); // fire-and-forget, same as POS
  return NextResponse.json({ sessionId });
}

// ─── GET /api/grab/weblogin?sessionId=xxx — poll for result ──────────────────
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const s = sessions.get(sessionId);
  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Consume done/error sessions after reading
  if (s.status !== "pending") sessions.delete(sessionId);

  return NextResponse.json({
    status: s.status,
    cookie: s.cookie,
    merchantId: s.merchantId,
    merchantGroupId: s.merchantGroupId,
    error: s.error,
  });
}
