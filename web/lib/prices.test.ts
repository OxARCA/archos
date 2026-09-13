import { describe, expect, it } from "vitest";
import { costMicroUsd, type Price, type TokenUsage } from "./prices";

const opus: Price = {
  input: 5,
  output: 25,
  cacheRead: 0.5,
  cacheWrite5m: 6.25,
  cacheWrite1h: 10,
  batchDiscountPercent: 50,
};
const none: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

describe("costMicroUsd", () => {
  it("prices each kind of token at its own rate", () => {
    expect(costMicroUsd(opus, { ...none, inputTokens: 1_000_000 })).toBe(5_000_000);
    expect(costMicroUsd(opus, { ...none, outputTokens: 100_000 })).toBe(2_500_000);
    expect(costMicroUsd(opus, { ...none, cacheReadTokens: 1_000_000 })).toBe(500_000);
    expect(costMicroUsd(opus, { ...none, cacheWrite5mTokens: 1_000_000 })).toBe(6_250_000);
    expect(costMicroUsd(opus, { ...none, cacheWrite1hTokens: 1_000_000 })).toBe(10_000_000);
  });

  it("adds the parts and rounds to whole micro-dollars", () => {
    const small: Price = { ...opus, input: 1, cacheWrite5m: 1.25 };
    // 3 input tokens at $1/M is 3; 7 cache-write tokens at $1.25/M is 8.75.
    expect(costMicroUsd(small, { ...none, inputTokens: 3, cacheWrite5mTokens: 7 })).toBe(12);
  });

  it("charges batch calls at the model's batch discount", () => {
    const call = { ...none, inputTokens: 1_000_000, outputTokens: 100_000 };
    expect(costMicroUsd(opus, call, true)).toBe(3_750_000);
    expect(costMicroUsd({ ...opus, batchDiscountPercent: 0 }, call, true)).toBe(7_500_000);
  });
});
