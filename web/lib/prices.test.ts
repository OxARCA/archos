import { describe, expect, it } from "vitest";
import { costMicroUsd, priceFor, PRICES, type TokenUsage } from "./prices";

const none: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

describe("costMicroUsd", () => {
  it("prices each kind of token at its own rate", () => {
    const opus = priceFor("anthropic", "claude-opus-5")!;
    expect(costMicroUsd(opus, { ...none, inputTokens: 1_000_000 })).toBe(5_000_000);
    expect(costMicroUsd(opus, { ...none, outputTokens: 100_000 })).toBe(2_500_000);
    expect(costMicroUsd(opus, { ...none, cacheReadTokens: 1_000_000 })).toBe(500_000);
    expect(costMicroUsd(opus, { ...none, cacheWrite5mTokens: 1_000_000 })).toBe(6_250_000);
    expect(costMicroUsd(opus, { ...none, cacheWrite1hTokens: 1_000_000 })).toBe(10_000_000);
  });

  it("adds the parts and rounds to whole micro-dollars", () => {
    const haiku = priceFor("anthropic", "claude-haiku-4-5")!;
    // 3 input tokens at $1/M is 3; 7 cache-write tokens at $1.25/M is 8.75.
    expect(costMicroUsd(haiku, { ...none, inputTokens: 3, cacheWrite5mTokens: 7 })).toBe(12);
  });
});

describe("price table", () => {
  it("has no price for models nobody has checked", () => {
    expect(priceFor("openai", "some-model")).toBeUndefined();
    expect(priceFor("anthropic", "claude-unknown")).toBeUndefined();
  });

  it("keeps Anthropic cache rates at 0.1x, 1.25x and 2x the input price", () => {
    for (const [key, p] of Object.entries(PRICES).filter(([k]) => k.startsWith("anthropic:"))) {
      expect(p.cacheRead, key).toBeCloseTo(p.input * 0.1);
      expect(p.cacheWrite5m, key).toBeCloseTo(p.input * 1.25);
      expect(p.cacheWrite1h, key).toBeCloseTo(p.input * 2);
    }
  });
});
