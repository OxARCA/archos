import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps paths on this site, with their query and fragment", () => {
    expect(safeNext("/usage")).toBe("/usage");
    expect(safeNext("/usage?x=1#h")).toBe("/usage?x=1#h");
    expect(safeNext(["/admin", "/other"])).toBe("/admin");
  });

  it("sends anything that could leave the site to the dashboard", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "", undefined]) {
      expect(safeNext(bad), JSON.stringify(bad)).toBe("/dashboard");
    }
  });

  it("sends addresses that aren't valid at all to the dashboard instead of failing", () => {
    expect(safeNext("//[")).toBe("/dashboard");
    expect(safeNext("//a b")).toBe("/dashboard");
  });
});
