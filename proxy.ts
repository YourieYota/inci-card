import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Proxy (Next.js 16) — replaces deprecated middleware.ts
 * Protects all dashboard/settings/receipt/upload routes.
 * Redirects unauthenticated users to /login.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve the JWT token from cookies
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If no valid token, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — check if it has expired (maxAge enforcement)
  // next-auth sets `exp` on the JWT automatically when maxAge is configured
  if (token.exp && typeof token.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now > token.exp) {
      // Token has expired — clear session and redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('expired', '1');
      const response = NextResponse.redirect(loginUrl);

      // Clear session cookies
      response.cookies.set('next-auth.session-token', '', {
        expires: new Date(0),
        path: '/',
      });
      response.cookies.set('__Secure-next-auth.session-token', '', {
        expires: new Date(0),
        path: '/',
      });

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/receipt/:path*',
    '/api/upload/:path*',
  ],
};
