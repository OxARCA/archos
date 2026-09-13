"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button, ErrorText, Field, Input } from "@/components/ui";

export function SignupForm({ emailHint }: { emailHint: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    const { error } = await signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
    });
    setPending(false);

    if (error) {
      setError(error.message ?? "Could not create the account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" hint={emailHint}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
