import { describe, expect, it } from "vitest";
import { formatUsd, parseUsd } from "./money";

describe("parseUsd", () => {
  it("reads dollar amounts into micro-dollars", () => {
    expect(parseUsd("20")).toBe(20_000_000);
    expect(parseUsd("12.5")).toBe(12_500_000);
    expect(parseUsd(" $1,250.05 ")).toBe(1_250_050_000);
    expect(parseUsd("0")).toBe(0);
  });

  it("rejects anything that isn't a plain amount", () => {
    for (const bad of ["", "-5", "1.234", "abc", "1e3", "12.", "9999999999", "12,50", "1,2,3", "1,000,000,000", null, undefined]) {
      expect(parseUsd(bad), String(bad)).toBeNull();
    }
  });
});

describe("formatUsd", () => {
  it("shows dollars and cents", () => {
    expect(formatUsd(12_500_000)).toBe("$12.50");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1_234_500_000)).toBe("$1,234.50");
  });

  it("keeps costs under a cent visible", () => {
    expect(formatUsd(2_100)).toBe("$0.0021");
    expect(formatUsd(30)).toBe("$0.00003");
  });
});
