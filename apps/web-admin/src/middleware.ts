import { type NextRequest, NextResponse } from "next/server";

import { ROUTE_PERMISSION_MAP } from "@/lib/permissions";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public
  if (pathname.startsWith("/login")) return NextResponse.next();

  const token = request.cookies.get("admin_access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== "string") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Do NOT check exp here — the client-side axios interceptor handles token
  // refresh on 401. Checking exp in middleware would kick users out before they
  // have a chance to refresh, since the cookie max-age outlives the JWT lifespan.

  // Super admin: full access to everything
  if (payload.role === "super_admin") return NextResponse.next();

  // Staff: attendance always accessible (hard safety-net, even with no permissions)
  if (pathname === "/attendance" || pathname.startsWith("/attendance/")) {
    return NextResponse.next();
  }

  const permissions = Array.isArray(payload.permissions)
    ? (payload.permissions as string[])
    : [];

  // Staff: dashboard exact "/"
  if (pathname === "/") {
    return permissions.includes("dashboard")
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/attendance", request.url));
  }

  // Staff: all other prefix-based routes
  for (const [routePrefix, permission] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (pathname.startsWith(routePrefix) && !permissions.includes(permission)) {
      return NextResponse.redirect(new URL("/attendance", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|icons|images).*)"],
};
