import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-fg no-underline hover:text-accent"
        >
          Archos
        </Link>
        <span className="hidden text-xs font-medium tracking-[0.16em] text-accent uppercase sm:inline">
          OxARCA
        </span>

        <nav aria-label="Primary" className="ml-auto flex items-center gap-1 text-sm">
          {session ? (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              {session.user.role === "admin" ? <NavLink href="/admin">Admin</NavLink> : null}
              <span className="hidden px-2 text-muted sm:inline">{session.user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <NavLink href="/login">Sign in</NavLink>
              <Link
                href="/signup"
                className="rounded-full bg-primary px-3 py-1.5 font-medium text-primary-fg no-underline hover:opacity-90"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-fg-2 no-underline transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </Link>
  );
}
