import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BanButton } from "@/components/admin/ban-button";
import { BudgetForm } from "@/components/admin/budget-form";
import { SiteHeader } from "@/components/site-header";
import { Card, Row } from "@/components/ui";
import { BudgetSummary, RecentCalls, UsageByModel } from "@/components/usage/usage-summary";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { budgetStatus } from "@/lib/budget";
import { MICRO_PER_USD } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { recentUsage, usageByModelThisMonth } from "@/lib/usage";

export const metadata: Metadata = { title: "User" };

const dollars = (micro: number) => (micro / MICRO_PER_USD).toFixed(2);

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  const { id } = await params;

  const [account] = await db.select().from(userTable).where(eq(userTable.id, id));
  if (!account) notFound();

  const [status, byModel, recent] = await Promise.all([
    budgetStatus(id),
    usageByModelThisMonth(id),
    recentUsage(id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <Link href="/admin" className="text-sm text-accent">
          ← All users
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">
          {account.name || account.email}
        </h1>
        <p className="mt-1 text-fg-2">{account.email}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Role">{account.role ?? "researcher"}</Row>
              <Row label="Status">{account.banned ? "banned" : "active"}</Row>
              <Row label="Joined">{account.createdAt.toLocaleDateString("en-GB")}</Row>
            </dl>
            <div className="mt-4">
              {account.id === session.user.id ? (
                <p className="text-xs text-muted">This is your own account.</p>
              ) : (
                <BanButton userId={account.id} email={account.email} banned={Boolean(account.banned)} />
              )}
            </div>
          </Card>
          <BudgetSummary status={status} />
        </div>

        <Card className="mt-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Caps</h2>
          <div className="mt-4">
            <BudgetForm
              userId={account.id}
              monthlyCapUsd={dollars(status.monthlyCapMicroUsd)}
              perJobCapUsd={dollars(status.perJobCapMicroUsd)}
            />
          </div>
        </Card>

        <div className="mt-4 flex flex-col gap-4">
          <UsageByModel rows={byModel} />
          <RecentCalls rows={recent} />
        </div>
      </main>
    </>
  );
}
