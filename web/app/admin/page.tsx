import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { BanButton } from "@/components/admin/ban-button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { allBudgets, teamCapMicroUsd } from "@/lib/budget";
import { formatUsd } from "@/lib/money";
import { PRICES, PRICES_CHECKED_ON } from "@/lib/prices";
import { requireAdmin } from "@/lib/session";
import { spentThisMonthByUser } from "@/lib/usage";

export const metadata: Metadata = { title: "Admin" };

const cell = "px-4 py-3";
const headCell = "px-4 py-3 font-medium";
const perMillion = (usd: number) => `$${usd.toFixed(2)}`;

export default async function AdminPage() {
  const session = await requireAdmin();

  const [{ users, total }, budgets, spent] = await Promise.all([
    auth.api.listUsers({
      headers: await headers(),
      query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
    }),
    allBudgets(),
    spentThisMonthByUser(),
  ]);
  const teamSpent = [...spent.values()].reduce((sum, n) => sum + n, 0);
  const teamCap = teamCapMicroUsd();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">Users</h1>
        <p className="mt-2 text-fg-2">
          {total} account{total === 1 ? "" : "s"}. Open a user to set their monthly cap; banning signs a
          user out at once.
        </p>
        <p className="mt-2 text-fg">
          Team spend this month: <strong>{formatUsd(teamSpent)}</strong>
          {teamCap === null ? " (no team-wide cap)" : ` of ${formatUsd(teamCap)} team cap`}
        </p>

        <Card className="mt-8 overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
                <th className={headCell}>Name</th>
                <th className={headCell}>Email</th>
                <th className={headCell}>Role</th>
                <th className={headCell}>Status</th>
                <th className={headCell}>This month</th>
                <th className={headCell}>Joined</th>
                <th className={headCell}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line-soft">
                  <td className={`${cell} text-fg`}>
                    <Link href={`/admin/users/${u.id}`} className="text-fg hover:text-accent">
                      {u.name || "—"}
                    </Link>
                  </td>
                  <td className={`${cell} text-fg-2`}>{u.email}</td>
                  <td className={cell}>
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-2">
                      {u.role ?? "researcher"}
                    </span>
                  </td>
                  <td className={`${cell} text-fg-2`}>{u.banned ? "banned" : "active"}</td>
                  <td className={`${cell} text-fg-2`}>
                    {formatUsd(spent.get(u.id) ?? 0)} of {formatUsd(budgets.get(u.id)?.monthlyCapMicroUsd ?? 0)}
                  </td>
                  <td className={`${cell} text-fg-2`}>{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className={`${cell} text-right`}>
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/users/${u.id}`} className="text-sm text-accent">
                        Manage
                      </Link>
                      {u.id === session.user.id ? (
                        <span className="text-xs text-muted">you</span>
                      ) : (
                        <BanButton userId={u.id} email={u.email} banned={Boolean(u.banned)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <h2 className="mt-12 font-display text-xl font-semibold text-fg">Model prices</h2>
        <p className="mt-1 text-sm text-fg-2">
          US$ per million tokens, checked on {PRICES_CHECKED_ON}. A model not listed here has no price,
          so a job using it stops at once. Prices live in <code>lib/prices.ts</code>.
        </p>
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
                <th className={headCell}>Model</th>
                <th className={`${headCell} text-right`}>Input</th>
                <th className={`${headCell} text-right`}>Output</th>
                <th className={`${headCell} text-right`}>Cache read</th>
                <th className={`${headCell} text-right`}>Cache write (5 min / 1 h)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(PRICES).map(([key, p]) => (
                <tr key={key} className="border-t border-line-soft">
                  <td className={`${cell} text-fg`}>{key}</td>
                  <td className={`${cell} text-right text-fg-2`}>{perMillion(p.input)}</td>
                  <td className={`${cell} text-right text-fg-2`}>{perMillion(p.output)}</td>
                  <td className={`${cell} text-right text-fg-2`}>{perMillion(p.cacheRead)}</td>
                  <td className={`${cell} text-right text-fg-2`}>
                    {perMillion(p.cacheWrite5m)} / {perMillion(p.cacheWrite1h)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
