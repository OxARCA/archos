/**
 * Model prices in US dollars per million tokens (notes/03-usage-metering-and-admin.md).
 * Cost is worked out when usage is recorded, so changing a price here never
 * rewrites history. A model that isn't listed has no price, and the budget
 * code gives it no budget, so a job using it stops at once.
 *
 * Anthropic: first-party API rates. Cache reads are 0.1x the input price; cache
 * writes are 1.25x for the 5-minute cache and 2x for the 1-hour cache.
 * Confirm at https://www.anthropic.com/pricing before changing a row.
 * OpenAI: add rows once the team confirms which models the pipeline uses.
 */
export const PRICES_CHECKED_ON = "2026-09-13";

export type Price = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

export const PRICES: Record<string, Price> = {
  "anthropic:claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  "anthropic:claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  "anthropic:claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

/** Token counts for one model call, split the way the providers bill them. */
export type TokenUsage = {
  /** Input not read from or written to the cache. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
};

export function priceFor(provider: string, model: string): Price | undefined {
  return PRICES[`${provider}:${model}`];
}

/** Cost in micro-dollars: tokens times dollars-per-million is micro-dollars. */
export function costMicroUsd(price: Price, usage: TokenUsage): number {
  return Math.round(
    usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWrite5mTokens * price.cacheWrite5m +
      usage.cacheWrite1hTokens * price.cacheWrite1h,
  );
}
