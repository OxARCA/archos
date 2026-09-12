import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic route protection (Next.js 16 "proxy", formerly middleware).
 * Only checks that a session cookie exists; every protected page and action
 * still verifies the session server-side via lib/session.ts.
 *
 * It does not send signed-in users away from /login or /signup: a cookie can
 * outlive its session (after a ban, for example), and redirecting on the cookie
 * alone loops between /login and /dashboard. Those pages check the real
 * session instead.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/jobs", "/collections", "/usage"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/jobs/:path*",
    "/collections/:path*",
    "/usage/:path*",
  ],
};
