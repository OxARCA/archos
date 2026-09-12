import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-16">
        <section className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Archos</p>
          <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight text-fg sm:text-5xl">
            An epistemically grounded LLM system for archival exploration
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-fg-2">
            Run Archos over your own collection with your own model key. Every claim stays
            traceable to a specific document, every ambiguity is left standing, and every
            token you spend is accounted for.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg no-underline hover:opacity-90"
              >
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg no-underline hover:opacity-90"
                >
                  Create an account
                </Link>
                <Link
                  href="/login"
                  className="rounded-md border border-line px-5 py-2.5 text-sm font-medium text-fg no-underline hover:border-accent hover:text-accent"
                >
                  Sign in
                </Link>
              </>
            )}
            <a
              href="https://oxarca.github.io/page/archos.html"
              className="rounded-md px-5 py-2.5 text-sm font-medium text-fg-2 no-underline hover:text-accent"
            >
              How the system works →
            </a>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Sign in">
            Email and password today; Google sign-in when configured; Oxford SSO later.
          </Step>
          <Step n="2" title="Add your model key">
            An OpenAI or Anthropic key, encrypted at rest and never shown again.
          </Step>
          <Step n="3" title="Run and read">
            Submit a research question and a collection; read the Evidence Report with its citations.
          </Step>
        </section>
      </main>
      <footer className="border-t border-line-soft py-6 text-center text-sm text-muted">
        OxARCA · AI for Research, Collections and Archives · University of Oxford
      </footer>
    </>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface p-5">
      <p className="font-display text-2xl text-accent">{n}</p>
      <h2 className="mt-1 font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-fg-2">{children}</p>
    </div>
  );
}
