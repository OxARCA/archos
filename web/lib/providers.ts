/**
 * The model providers a user can store a key for. Shared by server and client
 * code, so nothing secret belongs here.
 */
export const PROVIDER_IDS = ["openai", "anthropic"] as const;
export type Provider = (typeof PROVIDER_IDS)[number];

export const PROVIDERS: Record<Provider, { name: string; keyPrefix: string; consoleUrl: string }> = {
  openai: {
    name: "OpenAI",
    keyPrefix: "sk-",
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic",
    keyPrefix: "sk-ant-",
    consoleUrl: "https://console.anthropic.com/settings/keys",
  },
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

/** The only part of a key the app ever shows. */
export function last4(apiKey: string): string {
  return apiKey.slice(-4);
}

export type KeyFormatResult = { ok: true; apiKey: string } | { ok: false; message: string };

/**
 * Cheap checks before a key is sent anywhere. The prefix checks also stop an
 * Anthropic key being sent to OpenAI, or the reverse, by mistake.
 */
export function checkKeyFormat(provider: Provider, raw: unknown): KeyFormatResult {
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  const { name, keyPrefix } = PROVIDERS[provider];
  const looksLikeAnthropic = apiKey.startsWith(PROVIDERS.anthropic.keyPrefix);

  if (!apiKey) return { ok: false, message: `Paste your ${name} key first.` };
  if (apiKey.length > 512 || /\s/.test(apiKey)) {
    return {
      ok: false,
      message: "That doesn't look like an API key. Copy it again from your provider's console.",
    };
  }
  if (provider === "openai" && looksLikeAnthropic) {
    return { ok: false, message: "This is an Anthropic key. Paste it under Anthropic instead." };
  }
  if (provider === "anthropic" && !looksLikeAnthropic && apiKey.startsWith(PROVIDERS.openai.keyPrefix)) {
    return { ok: false, message: "This looks like an OpenAI key. Paste it under OpenAI instead." };
  }
  if (!apiKey.startsWith(keyPrefix)) {
    return {
      ok: false,
      message: `${name} keys start with "${keyPrefix}". Check that you copied the whole key.`,
    };
  }
  return { ok: true, apiKey };
}
