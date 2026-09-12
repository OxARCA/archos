import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { authProviders } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

/** Only allow same-origin relative paths as a post-login destination. */
function safeNext(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // Checked here rather than in proxy.ts, because a leftover cookie is not a session.
  if (await getSession()) redirect(safeNext(next));

  return (
    <AuthShell title="Sign in" lede="Welcome back. Sign in to reach your dashboard.">
      <LoginForm next={safeNext(next)} googleEnabled={authProviders.google} />
    </AuthShell>
  );
}
