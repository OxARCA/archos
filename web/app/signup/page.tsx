import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { authProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create an account"
      lede="New accounts start with no budget and no model key; an OxARCA admin enables them."
    >
      <SignupForm googleEnabled={authProviders.google} />
    </AuthShell>
  );
}
