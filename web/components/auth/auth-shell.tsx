import Link from "next/link";
import { Card } from "@/components/ui";

export function AuthShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <Link href="/" className="mb-8 font-display text-2xl font-semibold text-fg no-underline">
        Archos
      </Link>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-2 mb-6 text-fg-2">{lede}</p>
      <Card>{children}</Card>
    </main>
  );
}
