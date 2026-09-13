/** Money is stored as whole micro-dollars (millionths of a US dollar), so sums are exact. */
export const MICRO_PER_USD = 1_000_000;

/**
 * "20", "12.5" or "$1,250.05" → micro-dollars. Null for anything that isn't a
 * non-negative amount with at most two decimals.
 */
export function parseUsd(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const text = input.trim().replace(/^\$/, "");
  // Commas only between groups of three, so "12,50" is refused rather than read as 1250.
  if (!/^(\d{1,3}(,\d{3})*|\d+)(\.\d{1,2})?$/.test(text)) return null;
  const [whole, cents = ""] = text.replace(/,/g, "").split(".");
  if (whole.length > 9) return null;
  return Number(whole) * MICRO_PER_USD + Number(cents.padEnd(2, "0")) * 10_000;
}

/** Micro-dollars → "$12.50". Costs under a cent show every micro-dollar so they don't read as $0.00. */
export function formatUsd(micro: number): string {
  const usd = micro / MICRO_PER_USD;
  if (micro !== 0 && Math.abs(usd) < 0.01) return `$${usd.toFixed(6).replace(/0+$/, "")}`;
  return usd.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** A price in US dollars per million tokens: up to four decimals, at most $10,000. Null otherwise. */
export function parseRate(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const text = input.trim().replace(/^\$/, "");
  if (!/^\d{1,5}(\.\d{1,4})?$/.test(text)) return null;
  const rate = Number(text);
  return rate <= 10_000 ? rate : null;
}

/** A price per million tokens: "$6.25", "$0.075", "$10.00". */
export function formatRate(usd: number): string {
  const [whole, fraction = ""] = usd.toFixed(4).split(".");
  return `$${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
}
