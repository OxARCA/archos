import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { BudgetSummary, RecentCalls, UsageByModel } from "@/components/usage/usage-summary";
import { budgetStatus } from "@/lib/budget";
import { requireSession } from "@/lib/session";
import { recentUsage, usageByModelThisMonth } from "@/lib/usage";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage() {
  const { user } = await requireSession("/usage");
  const [status, byModel, recent] = await Promise.all([
    budgetStatus(user.id),
    usageByModelThisMonth(user.id),
    recentUsage(user.id),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Usage</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">Your model usage</h1>
        <p className="mt-2 max-w-2xl text-fg-2">
          Archos runs on the OxARCA team&apos;s model account. Every model call made for you is recorded
          here with its cost, and an admin sets how much you can spend each month.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <BudgetSummary status={status} />
          <UsageByModel rows={byModel} />
          <RecentCalls rows={recent} />
        </div>
      </main>
    </>
  );
}
