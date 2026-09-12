import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aadFor, decryptSecret, encryptSecret, sealApiKey } from "./vault";

const API_KEY = "sk-proj-test-0123456789abcdefWXYZ";
const newMasterKey = () => randomBytes(32).toString("base64");

beforeEach(() => {
  vi.stubEnv("KEY_ENCRYPTION_KEY_V1", newMasterKey());
});

describe("encryptSecret / decryptSecret", () => {
  it("decrypts what it encrypted", () => {
    const aad = aadFor("user-1", "openai");
    expect(decryptSecret(encryptSecret(API_KEY, aad), aad)).toBe(API_KEY);
  });

  it("uses a fresh IV every time, so the same key never encrypts the same way twice", () => {
    const aad = aadFor("user-1", "openai");
    const a = encryptSecret(API_KEY, aad);
    const b = encryptSecret(API_KEY, aad);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("refuses to decrypt for another user or provider (AAD mismatch)", () => {
    const sealed = encryptSecret(API_KEY, aadFor("user-1", "openai"));
    expect(() => decryptSecret(sealed, aadFor("user-2", "openai"))).toThrow();
    expect(() => decryptSecret(sealed, aadFor("user-1", "anthropic"))).toThrow();
  });

  it("refuses altered ciphertext and truncated tags", () => {
    const aad = aadFor("user-1", "openai");
    const sealed = encryptSecret(API_KEY, aad);
    const flipped = Buffer.from(sealed.ciphertext);
    flipped[0] ^= 1;
    expect(() => decryptSecret({ ...sealed, ciphertext: flipped }, aad)).toThrow();
    expect(() => decryptSecret({ ...sealed, tag: sealed.tag.subarray(0, 4) }, aad)).toThrow();
  });

  it("cannot decrypt with a different master key", () => {
    const aad = aadFor("user-1", "openai");
    const sealed = encryptSecret(API_KEY, aad);
    vi.stubEnv("KEY_ENCRYPTION_KEY_V1", newMasterKey());
    expect(() => decryptSecret(sealed, aad)).toThrow();
  });

  it("explains a missing or malformed master key", () => {
    vi.stubEnv("KEY_ENCRYPTION_KEY_V1", "");
    expect(() => encryptSecret(API_KEY, "aad")).toThrow(/KEY_ENCRYPTION_KEY_V1 is not set/);
    vi.stubEnv("KEY_ENCRYPTION_KEY_V1", Buffer.from("too short").toString("base64"));
    expect(() => encryptSecret(API_KEY, "aad")).toThrow(/32 random bytes/);
  });

  it("names the master key a row needs when that version is missing", () => {
    const sealed = { ...encryptSecret(API_KEY, "aad"), keyVersion: 2 };
    expect(() => decryptSecret(sealed, "aad")).toThrow(/KEY_ENCRYPTION_KEY_V2/);
  });
});

describe("sealApiKey", () => {
  it("builds a row that holds no trace of the key except its last four characters", () => {
    const row = sealApiKey("user-1", "openai", API_KEY);

    expect(row.last4).toBe("WXYZ");
    expect(row.iv).toHaveLength(12);
    expect(row.tag).toHaveLength(16);
    for (const bytes of [row.ciphertext, row.iv, row.tag]) {
      expect(bytes.includes(Buffer.from(API_KEY))).toBe(false);
      expect(bytes.includes(Buffer.from("sk-proj"))).toBe(false);
    }
    expect(JSON.stringify(row)).not.toContain(API_KEY);
    expect(decryptSecret(row, aadFor("user-1", "openai"))).toBe(API_KEY);
  });
});
