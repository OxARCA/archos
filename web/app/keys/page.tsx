import type { Metadata } from "next";
import { KeyForm } from "@/components/keys/key-form";
import { RemoveKeyForm } from "@/components/keys/remove-key-form";
import { SiteHeader } from "@/components/site-header";
import { Card, Row } from "@/components/ui";
import { listSavedKeys, type SavedKey } from "@/lib/provider-keys";
import { PROVIDER_IDS, PROVIDERS, type Provider } from "@/lib/providers";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "API keys" };

export default async function KeysPage() {
  const session = await requireSession("/keys");
  const saved = await listSavedKeys(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Model keys</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">
          Your API keys
        </h1>
        <p className="mt-2 max-w-2xl text-fg-2">
          Archos runs your jobs with your own key, so the provider bills you directly. Keys are
          encrypted before they are stored. Once saved, nobody can read a key back, including you;
          only its last four characters are shown.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROVIDER_IDS.map((provider) => (
            <KeyCard
              key={provider}
              provider={provider}
              saved={saved.find((k) => k.provider === provider)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function KeyCard({ provider, saved }: { provider: Provider; saved?: SavedKey }) {
  const { name, consoleUrl } = PROVIDERS[provider];
  const consoleLink = (
    <a href={consoleUrl} target="_blank" rel="noreferrer" className="text-accent">
      {name} console
    </a>
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{name}</h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-2">
          {saved ? "Saved" : "Not set"}
        </span>
      </div>

      {saved ? (
        <>
          <dl className="space-y-2 text-sm">
            <Row label="Key">
              <span className="font-mono">••••{saved.last4}</span>
            </Row>
            <Row label={`Checked with ${name}`}>{formatDate(saved.validatedAt)}</Row>
          </dl>
          <details>
            <summary className="cursor-pointer text-sm text-accent">Replace with a new key</summary>
            <div className="mt-3">
              <KeyForm provider={provider} replacing />
            </div>
          </details>
          <div className="flex flex-col items-start gap-2 border-t border-line-soft pt-4">
            <RemoveKeyForm provider={provider} />
            <p className="text-xs text-muted">
              Removing the key here stops Archos using it. To switch it off everywhere, also delete
              it in your {consoleLink}.
            </p>
          </div>
        </>
      ) : (
        <>
          <KeyForm provider={provider} />
          <p className="text-xs text-muted">No key yet? Create one in your {consoleLink}.</p>
        </>
      )}
    </Card>
  );
}

function formatDate(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "never";
}
