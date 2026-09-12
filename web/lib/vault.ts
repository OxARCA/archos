import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { last4, type Provider } from "./providers";

/**
 * The key vault: AES-256-GCM with a versioned master key
 * (notes/02-auth-and-api-keys.md).
 *
 * Master keys come from KEY_ENCRYPTION_KEY_V<n>: 32 random bytes, base64.
 * Every row records the version that encrypted it. To rotate, add V2, set
 * CURRENT_KEY_VERSION to 2, re-encrypt the old rows, then remove V1.
 */
const CURRENT_KEY_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type Sealed = { ciphertext: Buffer; iv: Buffer; tag: Buffer; keyVersion: number };

// Read on every call rather than at import, so `next build` works without it.
function masterKey(version: number): Buffer {
  const name = `KEY_ENCRYPTION_KEY_V${version}`;
  const encoded = process.env[name];
  if (!encoded) throw new Error(`${name} is not set (see .env.example).`);
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error(`${name} must be 32 random bytes, base64-encoded.`);
  return key;
}

export function encryptSecret(plaintext: string, aad: string): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey(CURRENT_KEY_VERSION), iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag(), keyVersion: CURRENT_KEY_VERSION };
}

/** Throws if the data was altered, or if `aad` differs from the one used to encrypt. */
export function decryptSecret(sealed: Sealed, aad: string): string {
  const decipher = createDecipheriv(ALGORITHM, masterKey(sealed.keyVersion), sealed.iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}

/** Binds a ciphertext to its owner, so a row copied to another user will not decrypt. */
export function aadFor(userId: string, provider: Provider): string {
  return `${userId}:${provider}`;
}

/** The provider_keys columns for a key: the ciphertext and the last four characters. */
export function sealApiKey(userId: string, provider: Provider, apiKey: string) {
  return { ...encryptSecret(apiKey, aadFor(userId, provider)), last4: last4(apiKey) };
}
