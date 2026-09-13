"use client";

import { useActionState } from "react";
import { saveBudgetAction, type BudgetFormState } from "@/app/admin/actions";
import { Button, ErrorText, Field, Input } from "@/components/ui";

const initialState: BudgetFormState = { status: "idle", message: "" };

export function BudgetForm({
  userId,
  monthlyCapUsd,
  perJobCapUsd,
}: {
  userId: string;
  monthlyCapUsd: string;
  perJobCapUsd: string;
}) {
  const [state, formAction, pending] = useActionState(saveBudgetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Monthly cap (US$)"
          htmlFor="monthlyCap"
          hint="Resets on the 1st of each month (UTC). 0 means no spending."
        >
          <Input
            id="monthlyCap"
            name="monthlyCap"
            inputMode="decimal"
            defaultValue={state.entered?.monthlyCap ?? monthlyCapUsd}
            required
          />
        </Field>
        <Field label="Per-job cap (US$)" htmlFor="perJobCap" hint="The most one research question may cost.">
          <Input
            id="perJobCap"
            name="perJobCap"
            inputMode="decimal"
            defaultValue={state.entered?.perJobCap ?? perJobCapUsd}
            required
          />
        </Field>
      </div>
      <ErrorText>{state.status === "error" ? state.message : null}</ErrorText>
      {state.status === "saved" ? (
        <p role="status" className="text-sm text-fg-2">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save caps"}
      </Button>
    </form>
  );
}
