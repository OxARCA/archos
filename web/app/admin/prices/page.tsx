import type { Metadata } from "next";
import Link from "next/link";
import { PriceForm } from "@/components/admin/price-form";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { listPrices } from "@/lib/prices";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Model prices" };

export default async function PricesPage() {
  await requireAdmin();
  const prices = await listPrices();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <Link href="/admin" className="text-sm text-accent">
          ← All users
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">Model prices</h1>
        <div className="mt-2 max-w-3xl space-y-2 text-fg-2">
          <p>
            Prices are in US$ per million tokens, at the provider&apos;s standard rates. A call is costed with
            the price in force when it is recorded, so a change applies from the next call and never alters
            past costs. Every change is recorded in the audit log.
          </p>
          <p>
            A model not listed here has no price, and a job that uses it stops at once. <em>Batch % off</em>{" "}
            applies to calls sent through the provider&apos;s Batch API; both providers usually charge half
            price there.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {prices.map((p) => (
            <Card key={`${p.provider}:${p.model}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-fg">
                  {p.model} <span className="text-xs font-normal text-muted">{p.provider}</span>
                </h2>
                <span className="text-xs text-muted">Updated {p.updatedAt.toLocaleDateString("en-GB")}</span>
              </div>
              <div className="mt-3">
                <PriceForm
                  values={{
                    provider: p.provider,
                    model: p.model,
                    input: String(p.input),
                    output: String(p.output),
                    cacheRead: String(p.cacheRead),
                    cacheWrite5m: String(p.cacheWrite5m),
                    cacheWrite1h: String(p.cacheWrite1h),
                    batchDiscountPercent: String(p.batchDiscountPercent),
                  }}
                />
              </div>
            </Card>
          ))}

          <Card className="border-dashed">
            <h2 className="font-semibold text-fg">Add a model</h2>
            <p className="mt-1 text-sm text-fg-2">
              Copy the standard (not batch) rates from the provider&apos;s pricing page. For OpenAI,
              &ldquo;cached input&rdquo; is the cache-read price; leave a cache-write price at 0 unless the model
              charges for it.
            </p>
            <div className="mt-3">
              <PriceForm
                isNew
                values={{
                  provider: "openai",
                  model: "",
                  input: "",
                  output: "",
                  cacheRead: "",
                  cacheWrite5m: "0",
                  cacheWrite1h: "0",
                  batchDiscountPercent: "50",
                }}
              />
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
