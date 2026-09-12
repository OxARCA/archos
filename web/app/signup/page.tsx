import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { authProviders } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <AuthShell
      title="Create an account"
      lede="New accounts start with no budget; an OxARCA admin enables them."
    >
      <SignupForm googleEnabled={authProviders.google} />
    </AuthShell>
  );
}
