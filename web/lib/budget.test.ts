import { describe, expect, it, vi } from "vitest";
import { monthStart, nextMonthStart, remainingMicroUsd, teamCapMicroUsd } from "./budget";

describe("months", () => {
  it("start at midnight UTC on the 1st", () => {
    expect(monthStart(new Date("2026-09-13T14:30:00Z")).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(monthStart(new Date("2026-01-01T00:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(nextMonthStart(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("remainingMicroUsd", () => {
  it("is the cap minus what was spent, never below zero", () => {
    expect(remainingMicroUsd({ capMicroUsd: 10, spentMicroUsd: 4, teamCapMicroUsd: null, teamSpentMicroUsd: 0 })).toBe(6);
    expect(remainingMicroUsd({ capMicroUsd: 10, spentMicroUsd: 15, teamCapMicroUsd: null, teamSpentMicroUsd: 0 })).toBe(0);
  });

  it("never exceeds what is left of the team cap", () => {
    expect(remainingMicroUsd({ capMicroUsd: 10, spentMicroUsd: 0, teamCapMicroUsd: 100, teamSpentMicroUsd: 97 })).toBe(3);
    expect(remainingMicroUsd({ capMicroUsd: 10, spentMicroUsd: 0, teamCapMicroUsd: 100, teamSpentMicroUsd: 120 })).toBe(0);
  });
});

describe("teamCapMicroUsd", () => {
  it("reads TEAM_MONTHLY_USD_CAP in dollars, or no team cap when empty", () => {
    vi.stubEnv("TEAM_MONTHLY_USD_CAP", "200");
    expect(teamCapMicroUsd()).toBe(200_000_000);
    vi.stubEnv("TEAM_MONTHLY_USD_CAP", "");
    expect(teamCapMicroUsd()).toBeNull();
  });

  it("treats a value that isn't an amount as $0, so a typo stops spending", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("TEAM_MONTHLY_USD_CAP", "200 dollars");
    expect(teamCapMicroUsd()).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
