import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic route protection (Next.js 16 "proxy", formerly middleware).
 * Only checks that a session cookie exists; every protected page and action
 * still verifies the session server-side via lib/session.ts.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/keys", "/jobs", "/collections", "/usage"];
const AUTH_PAGES = new Set(["/login", "/signup"]);

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

  if (AUTH_PAGES.has(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/keys/:path*",
    "/jobs/:path*",
    "/collections/:path*",
    "/usage/:path*",
    "/login",
    "/signup",
  ],
};
