import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { signUpPolicy } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

function lede(): string {
  const { open, domains } = signUpPolicy;
  if (!open) return "Sign-up is by invitation. Use the email address the OxARCA team added for you.";
  return `Sign up with an address at ${domains.join(", ")}, or the address the OxARCA team invited.`;
}

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <AuthShell title="Create an account" lede={lede()}>
      <SignupForm
        emailHint={
          signUpPolicy.open
            ? "Use your institutional address if you have one."
            : "The address the OxARCA team invited."
        }
      />
    </AuthShell>
  );
}
