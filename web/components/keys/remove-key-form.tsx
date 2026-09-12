"use client";

import { useFormStatus } from "react-dom";
import { removeKeyAction } from "@/app/keys/actions";
import { Button } from "@/components/ui";
import { PROVIDERS, type Provider } from "@/lib/providers";

export function RemoveKeyForm({ provider }: { provider: Provider }) {
  const { name } = PROVIDERS[provider];

  return (
    <form
      action={removeKeyAction}
      onSubmit={(event) => {
        if (!window.confirm(`Remove your ${name} key? Archos won't be able to use it after this.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="provider" value={provider} />
      <RemoveButton />
    </form>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Removing…" : "Remove key"}
    </Button>
  );
}
