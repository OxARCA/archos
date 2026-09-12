import "server-only";

import { PROVIDERS, type Provider } from "./providers";

/**
 * Asks the provider whether a key works. Listing models is free and spends no
 * tokens. The key travels only in the request header.
 */
const API_BASE: Record<Provider, string> = {
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
};

export type KeyCheck = { ok: true } | { ok: false; message: string };

function apiBase(provider: Provider): string {
  // Development and tests only: send checks to a local stand-in for the
  // providers. Ignored in production, so real keys only go to the providers.
  const override = process.env.NODE_ENV !== "production" ? process.env.KEY_CHECK_BASE_URL : undefined;
  return override || API_BASE[provider];
}

function authHeaders(provider: Provider, apiKey: string): Record<string, string> {
  return provider === "openai"
    ? { authorization: `Bearer ${apiKey}` }
    : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
}

export async function checkWithProvider(provider: Provider, apiKey: string): Promise<KeyCheck> {
  const { name } = PROVIDERS[provider];

  let status: number;
  try {
    const response = await fetch(`${apiBase(provider)}/v1/models`, {
      headers: authHeaders(provider, apiKey),
      cache: "no-store",
      // A redirect could carry the key to another host.
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    await response.body?.cancel();
  } catch {
    return { ok: false, message: `Couldn't reach ${name} to check the key. Try again in a minute.` };
  }

  if (status === 200) return { ok: true };
  if (status === 401) {
    return {
      ok: false,
      message: `${name} didn't accept this key. Check that you copied all of it and that it hasn't been deleted.`,
    };
  }
  if (status === 403) {
    return {
      ok: false,
      message: `${name} recognised the key but refused access. Check its permissions in your ${name} console.`,
    };
  }
  return {
    ok: false,
    message: `${name} couldn't check the key right now (status ${status}). Try again in a minute.`,
  };
}
