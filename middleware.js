// middleware.js
//
// Gates everything in the Review Intelligence tool EXCEPT:
//   - /login (the login page itself)
//   - /api/review-auth/* (the auth API routes)
//
// If no valid review_session cookie → redirect to /login (preserving ?next=)

import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession, buildClearCookie } from './lib/reviewAuth';

export const config = {
  // Match all routes EXCEPT static assets, images, and favicon.
  // The login page and auth API are allowed through inside the function.
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimisation files)
     * - favicon.ico
     * - any file with an extension (e.g. .png, .svg, .ico, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Allow login page and auth API endpoints through
  if (pathname === '/login' || pathname.startsWith('/api/review-auth/')) {
    return NextResponse.next();
  }

  const secret = process.env.REVIEW_AUTH_SECRET;
  const cookie = request.cookies.get(COOKIE_NAME);

  const redirectToLogin = (clearCookie = false) => {
    const loginUrl = new URL('/login', request.url);
    const next = pathname + (search || '');
    if (next !== '/' && next !== '/login' && !next.startsWith('/login')) {
      loginUrl.searchParams.set('next', next);
    }
    const res = NextResponse.redirect(loginUrl);
    if (clearCookie) res.headers.append('Set-Cookie', buildClearCookie());
    return res;
  };

  if (!cookie?.value || !secret) {
    return redirectToLogin(false);
  }

  const payload = await verifySession(cookie.value, secret.trim());
  if (!payload) {
    return redirectToLogin(true);
  }

  // Valid session — pass user info along as a request header for the tool to use
  const response = NextResponse.next();
  response.headers.set('x-review-user', payload.email);
  if (payload.role) response.headers.set('x-review-role', payload.role);
  return response;
}
