import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-next";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // Checked here rather than in proxy.ts, because a leftover cookie is not a session.
  if (await getSession()) redirect(safeNext(next));

  return (
    <AuthShell title="Sign in" lede="Welcome back. Sign in to reach your dashboard.">
      <LoginForm next={safeNext(next)} />
    </AuthShell>
  );
}
