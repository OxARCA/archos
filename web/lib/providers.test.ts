import { describe, expect, it } from "vitest";
import { checkKeyFormat, isProvider, last4 } from "./providers";

describe("checkKeyFormat", () => {
  it("accepts well-formed keys and trims pasted whitespace", () => {
    expect(checkKeyFormat("openai", "  sk-proj-abc123\n")).toEqual({ ok: true, apiKey: "sk-proj-abc123" });
    expect(checkKeyFormat("anthropic", "sk-ant-api03-abc")).toEqual({ ok: true, apiKey: "sk-ant-api03-abc" });
  });

  it("asks for a key when the field is empty", () => {
    expect(checkKeyFormat("openai", "   ")).toEqual({ ok: false, message: "Paste your OpenAI key first." });
    expect(checkKeyFormat("openai", null).ok).toBe(false);
  });

  it("rejects whitespace inside a key and absurdly long input", () => {
    expect(checkKeyFormat("openai", "sk-proj abc").ok).toBe(false);
    expect(checkKeyFormat("openai", `sk-${"a".repeat(600)}`).ok).toBe(false);
  });

  it("never lets an Anthropic key go to OpenAI, or the reverse", () => {
    expect(checkKeyFormat("openai", "sk-ant-api03-abc")).toMatchObject({
      ok: false,
      message: expect.stringContaining("Anthropic key"),
    });
    expect(checkKeyFormat("anthropic", "sk-proj-abc")).toMatchObject({
      ok: false,
      message: expect.stringContaining("OpenAI key"),
    });
  });

  it("rejects keys without the provider's prefix", () => {
    expect(checkKeyFormat("openai", "abc123")).toMatchObject({ ok: false, message: expect.stringContaining('"sk-"') });
    expect(checkKeyFormat("anthropic", "abc123")).toMatchObject({ ok: false, message: expect.stringContaining('"sk-ant-"') });
  });
});

describe("helpers", () => {
  it("recognises providers", () => {
    expect(isProvider("openai")).toBe(true);
    expect(isProvider("gemini")).toBe(false);
    expect(isProvider(null)).toBe(false);
  });

  it("shows only the last four characters", () => {
    expect(last4("sk-proj-abcdWXYZ")).toBe("WXYZ");
  });
});
