import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card, Row } from "@/components/ui";
import { budgetStatus } from "@/lib/budget";
import { formatUsd } from "@/lib/money";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireSession("/dashboard");
  const { denied } = await searchParams;
  const { user } = session;
  const budget = await budgetStatus(user.id);

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
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Usage this month</h2>
              <Link href="/usage" className="text-sm text-accent">
                Details
              </Link>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Spent">{formatUsd(budget.spentMicroUsd)}</Row>
              <Row label="Monthly cap">
                {budget.monthlyCapMicroUsd > 0 ? formatUsd(budget.monthlyCapMicroUsd) : "not set yet"}
              </Row>
              <Row label="Left to spend">{formatUsd(budget.remainingMicroUsd)}</Row>
            </dl>
          </Card>

          <Card className="border-dashed">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Jobs</h2>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">Coming next</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-fg-2">
              Submit a research question over a collection and read the Evidence Report.
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
