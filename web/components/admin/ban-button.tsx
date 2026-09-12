"use client";

import { useActionState } from "react";
import { setBannedAction, type BanState } from "@/app/admin/actions";
import { Button } from "@/components/ui";

const initialState: BanState = { error: null };

export function BanButton({ userId, email, banned }: { userId: string; email: string; banned: boolean }) {
  const [state, formAction, pending] = useActionState(setBannedAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const question = `Ban ${email}? They are signed out straight away and cannot sign in until you unban them.`;
        if (!banned && !window.confirm(question)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="ban" value={banned ? "false" : "true"} />
      <Button type="submit" variant={banned ? "secondary" : "danger"} disabled={pending}>
        {banned ? "Unban" : "Ban"}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
