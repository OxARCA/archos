import type { Metadata } from "next";
import { headers } from "next/headers";
import { BanButton } from "@/components/admin/ban-button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await requireAdmin();

  const { users, total } = await auth.api.listUsers({
    headers: await headers(),
    query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">Users</h1>
        <p className="mt-2 text-fg-2">
          {total} account{total === 1 ? "" : "s"}. Banning signs a user out at once. Budgets and job
          controls arrive in phase 3.
        </p>

        <Card className="mt-8 overflow-x-auto p-0">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line-soft">
                  <td className="px-4 py-3 text-fg">{u.name}</td>
                  <td className="px-4 py-3 text-fg-2">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-2">
                      {u.role ?? "researcher"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{u.banned ? "banned" : "active"}</td>
                  <td className="px-4 py-3 text-fg-2">
                    {new Date(u.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id === session.user.id ? (
                      <span className="text-xs text-muted">you</span>
                    ) : (
                      <BanButton userId={u.id} email={u.email} banned={Boolean(u.banned)} />
                    )}
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
