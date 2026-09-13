import { Card, Row } from "@/components/ui";
import { nextMonthStart, type BudgetStatus } from "@/lib/budget";
import { formatUsd } from "@/lib/money";
import type { ModelUsage, UsageRow } from "@/lib/usage";

const tokens = (n: number) => n.toLocaleString("en-GB");
const heading = "text-sm font-semibold tracking-wide text-muted uppercase";

export function BudgetSummary({ status }: { status: BudgetStatus }) {
  const { monthlyCapMicroUsd: cap, spentMicroUsd: spent } = status;
  const percent = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : spent > 0 ? 100 : 0;
  const resets = nextMonthStart().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Card>
      <h2 className={heading}>This month</h2>
      <p className="mt-3 font-display text-3xl font-semibold text-fg">
        {formatUsd(spent)} <span className="text-base font-normal text-fg-2">of {formatUsd(cap)}</span>
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Share of the monthly cap spent"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Left to spend">{formatUsd(status.remainingMicroUsd)}</Row>
        <Row label="Per-job cap">{formatUsd(status.perJobCapMicroUsd)}</Row>
        <Row label="Resets">{resets}</Row>
      </dl>
      {cap === 0 ? (
        <p className="mt-4 text-sm text-fg-2">
          No monthly budget is set yet. An OxARCA admin sets it before any job can run.
        </p>
      ) : null}
    </Card>
  );
}

export function UsageByModel({ rows }: { rows: ModelUsage[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <h2 className={`${heading} px-6 pt-5`}>By model, this month</h2>
      {rows.length === 0 ? (
        <p className="px-6 pt-3 pb-6 text-sm text-fg-2">No model calls yet this month.</p>
      ) : (
        <table className="mt-3 w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 text-right font-medium">Calls</th>
              <th className="px-4 py-3 text-right font-medium">Tokens in</th>
              <th className="px-4 py-3 text-right font-medium">Tokens out</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.provider}:${r.model}`} className="border-t border-line-soft">
                <td className="px-4 py-3 text-fg">
                  {r.model} <span className="text-xs text-muted">{r.provider}</span>
                </td>
                <td className="px-4 py-3 text-right text-fg-2">{tokens(r.calls)}</td>
                <td className="px-4 py-3 text-right text-fg-2">{tokens(r.inputTokens)}</td>
                <td className="px-4 py-3 text-right text-fg-2">{tokens(r.outputTokens)}</td>
                <td className="px-4 py-3 text-right text-fg">
                  {formatUsd(r.costMicroUsd)}
                  {r.unpricedCalls > 0 ? (
                    <span className="block text-xs text-danger">{r.unpricedCalls} with no price</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function RecentCalls({ rows }: { rows: UsageRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-x-auto p-0">
      <h2 className={`${heading} px-6 pt-5`}>Recent calls</h2>
      <table className="mt-3 w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
            <th className="px-4 py-3 font-medium">When (UTC)</th>
            <th className="px-4 py-3 font-medium">Model</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 text-right font-medium">Tokens in</th>
            <th className="px-4 py-3 text-right font-medium">Tokens out</th>
            <th className="px-4 py-3 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line-soft">
              <td className="px-4 py-3 text-fg-2">
                {r.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}
              </td>
              <td className="px-4 py-3 text-fg">{r.model}</td>
              <td className="px-4 py-3 text-fg-2">{r.stage ?? "–"}</td>
              <td className="px-4 py-3 text-right text-fg-2">{tokens(r.inputTokens)}</td>
              <td className="px-4 py-3 text-right text-fg-2">{tokens(r.outputTokens)}</td>
              <td className="px-4 py-3 text-right text-fg">
                {r.costMicroUsd === null ? <span className="text-danger">no price</span> : formatUsd(r.costMicroUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
