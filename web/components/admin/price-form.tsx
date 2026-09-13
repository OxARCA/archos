"use client";

import { useActionState } from "react";
import { removePriceAction, savePriceAction, type PriceFormState } from "@/app/admin/actions";
import { Button, ErrorText, Field, Input } from "@/components/ui";

const initialState: PriceFormState = { status: "idle", message: "" };

export type PriceValues = {
  provider: string;
  model: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite5m: string;
  cacheWrite1h: string;
  batchDiscountPercent: string;
};

const RATES = [
  { name: "input", label: "Input" },
  { name: "output", label: "Output" },
  { name: "cacheRead", label: "Cache read" },
  { name: "cacheWrite5m", label: "Cache write, 5 min" },
  { name: "cacheWrite1h", label: "Cache write, 1 h" },
] as const;

/** One model's prices. With isNew it also asks for the provider and model ID. */
export function PriceForm({ values, isNew = false }: { values: PriceValues; isNew?: boolean }) {
  const [state, formAction, pending] = useActionState(savePriceAction, initialState);
  const shown = { ...values, ...state.entered };
  const idFor = (name: string) => `${isNew ? "new" : `${values.provider}-${values.model}`}-${name}`.replace(/[^\w-]/g, "_");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {isNew ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider" htmlFor={idFor("provider")} hint="openai or anthropic">
            <Input id={idFor("provider")} name="provider" defaultValue={shown.provider} required />
          </Field>
          <Field label="Model ID" htmlFor={idFor("model")} hint="Exactly as the engine reports it">
            <Input id={idFor("model")} name="model" defaultValue={shown.model} required />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="provider" value={values.provider} />
          <input type="hidden" name="model" value={values.model} />
        </>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {RATES.map(({ name, label }) => (
          <Field key={name} label={label} htmlFor={idFor(name)}>
            <Input id={idFor(name)} name={name} inputMode="decimal" defaultValue={shown[name]} />
          </Field>
        ))}
        <Field label="Batch % off" htmlFor={idFor("batch")}>
          <Input
            id={idFor("batch")}
            name="batchDiscountPercent"
            inputMode="numeric"
            defaultValue={shown.batchDiscountPercent}
          />
        </Field>
      </div>

      <ErrorText>{state.status === "error" ? state.message : null}</ErrorText>
      {state.status === "saved" ? (
        <p role="status" className="text-sm text-fg-2">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add model" : "Save"}
        </Button>
        {isNew ? null : (
          <Button
            type="submit"
            variant="danger"
            formAction={removePriceAction}
            onClick={(event) => {
              if (!window.confirm(`Remove the price for ${values.model}? Calls to it will then stop their jobs.`)) {
                event.preventDefault();
              }
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
