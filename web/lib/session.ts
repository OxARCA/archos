import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Data Access Layer for the current request's session.
 * `cache` de-duplicates the lookup across layouts and pages in one render.
 */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Redirects to /login when there is no session. */
export async function requireSession(nextPath?: string) {
  const session = await getSession();
  if (!session) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return session;
}

/** Redirects non-admins to the dashboard. */
export async function requireAdmin() {
  const session = await requireSession("/admin");
  if (session.user.role !== "admin") redirect("/dashboard?denied=admin");
  return session;
}
