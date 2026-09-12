"use client";

import { useActionState } from "react";
import { saveKeyAction, type SaveKeyState } from "@/app/keys/actions";
import { Button, ErrorText, Field, Input } from "@/components/ui";
import { PROVIDERS, type Provider } from "@/lib/providers";

const initialState: SaveKeyState = { status: "idle", message: "" };

export function KeyForm({ provider, replacing = false }: { provider: Provider; replacing?: boolean }) {
  const [state, formAction, pending] = useActionState(saveKeyAction, initialState);
  const { name, keyPrefix } = PROVIDERS[provider];
  const inputId = replacing ? `${provider}-new-key` : `${provider}-key`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="provider" value={provider} />
      <Field
        label={replacing ? `New ${name} key` : `${name} API key`}
        htmlFor={inputId}
        hint={`Starts with ${keyPrefix}. We check it with ${name} before saving.`}
      >
        <Input
          id={inputId}
          name="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={`${keyPrefix}…`}
          required
        />
      </Field>
      <ErrorText>{state.status === "error" ? state.message : null}</ErrorText>
      {state.status === "saved" ? (
        <p role="status" className="text-sm text-fg-2">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : replacing ? "Check and replace" : "Check and save"}
      </Button>
    </form>
  );
}
