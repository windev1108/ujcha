import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { locales } from './i18n/config';

const intlMiddleware = createMiddleware(routing);

const PROTECTED = ['/cart', '/checkout', '/profile', '/orders', '/notifications', '/vouchers'];
const localePattern = locales.join('|');

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = request.cookies.get('kun-auth-state')?.value === '1';

  // Redirect authenticated users away from auth pages
  const isAuthPage = new RegExp(`^/(${localePattern})/(login|register|forgot-password)(/.*)?$`).test(pathname);
  if (isAuthPage && isAuth) {
    const locale = pathname.split('/')[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED.some((p) =>
    new RegExp(`^/(${localePattern})${p}(/.*)?$`).test(pathname),
  );
  if (isProtected && !isAuth) {
    const locale = pathname.split('/')[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
