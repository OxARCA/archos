import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card, Row } from "@/components/ui";
import { listSavedKeys } from "@/lib/provider-keys";
import { PROVIDER_IDS, PROVIDERS } from "@/lib/providers";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireSession("/dashboard");
  const { denied } = await searchParams;
  const { user } = session;
  const keys = await listSavedKeys(user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">
          Welcome, {user.name || user.email}
        </h1>

        {denied === "admin" ? (
          <p role="alert" className="mt-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg-2">
            That page is for administrators only.
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Email">{user.email}</Row>
              <Row label="Role">{user.role ?? "researcher"}</Row>
              <Row label="Email verified">{user.emailVerified ? "yes" : "not yet"}</Row>
              <Row label="Member since">{user.createdAt.toLocaleDateString("en-GB")}</Row>
            </dl>
          </Card>

          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Model keys</h2>
              <Link href="/keys" className="text-sm text-accent">
                Manage
              </Link>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {PROVIDER_IDS.map((provider) => {
                const key = keys.find((k) => k.provider === provider);
                return (
                  <Row key={provider} label={PROVIDERS[provider].name}>
                    {key ? <span className="font-mono">••••{key.last4}</span> : "not set"}
                  </Row>
                );
              })}
            </dl>
          </Card>
          <Placeholder title="Jobs" phase="Phase 2">
            Submit a research question over a collection and read the Evidence Report.
          </Placeholder>
          <Placeholder title="Usage and budget" phase="Phase 3">
            Tokens and dollars this month against the cap an admin sets for you.
          </Placeholder>
        </div>
      </main>
    </>
  );
}

function Placeholder({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{phase}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-2">{children}</p>
    </Card>
  );
}
