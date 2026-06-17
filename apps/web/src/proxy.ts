import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PREFIXES = [
  '/profile', '/orders',
  '/notifications', '/vouchers', '/rewards', '/addresses',
  '/group-order/sessions',
];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

// Order detail by paymentCode is guest-accessible (paymentCode is unguessable).
// Pattern: /orders/UJCHA-XXXXXXXX (with optional locale prefix like /en/orders/…)
const ORDER_DETAIL_RE = /(?:^|\/[a-z]{2})\/orders\/UJCHA-[0-9A-F]{8}(?:\/|$)/i;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = request.cookies.get('kun-auth-state')?.value === '1';

  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isAuthPage && isAuth) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !isAuth && !ORDER_DETAIL_RE.test(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
