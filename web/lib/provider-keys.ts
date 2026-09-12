import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys } from "@/db/app-schema";
import { recordAudit } from "./audit";
import { checkWithProvider } from "./key-check";
import { checkKeyFormat, type Provider } from "./providers";
import { sealApiKey } from "./vault";

/** What the app may know about a saved key: never the key itself. */
export type SavedKey = {
  provider: Provider;
  last4: string;
  validatedAt: Date | null;
  createdAt: Date;
};

export type SaveResult = { ok: true; key: SavedKey; replaced: boolean } | { ok: false; message: string };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function activeKey(userId: string, provider?: Provider) {
  return and(
    eq(providerKeys.userId, userId),
    isNull(providerKeys.revokedAt),
    provider ? eq(providerKeys.provider, provider) : undefined,
  );
}

export async function listSavedKeys(userId: string): Promise<SavedKey[]> {
  return db
    .select({
      provider: providerKeys.provider,
      last4: providerKeys.last4,
      validatedAt: providerKeys.validatedAt,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(activeKey(userId));
}

/**
 * Checks a key with its provider, then stores it encrypted, replacing the
 * user's current key for that provider.
 */
export async function saveProviderKey(
  userId: string,
  provider: Provider,
  rawKey: unknown,
): Promise<SaveResult> {
  const format = checkKeyFormat(provider, rawKey);
  if (!format.ok) return format;

  const check = await checkWithProvider(provider, format.apiKey);
  if (!check.ok) return check;

  const sealed = sealApiKey(userId, provider, format.apiKey);

  try {
    return await db.transaction(async (tx): Promise<SaveResult> => {
      const replaced = await revokeActiveKey(tx, userId, provider, "replaced");
      const [saved] = await tx
        .insert(providerKeys)
        .values({ userId, provider, ...sealed, validatedAt: new Date() })
        .returning({
          id: providerKeys.id,
          last4: providerKeys.last4,
          validatedAt: providerKeys.validatedAt,
          createdAt: providerKeys.createdAt,
        });
      await recordAudit(
        {
          actorId: userId,
          action: "key.saved",
          targetType: "provider_key",
          targetId: saved.id,
          metadata: { provider, last4: saved.last4 },
        },
        tx,
      );
      return {
        ok: true,
        replaced,
        key: { provider, last4: saved.last4, validatedAt: saved.validatedAt, createdAt: saved.createdAt },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        message: "Another save for this key ran at the same time. Reload the page to see which one was kept.",
      };
    }
    throw error;
  }
}

/** Stops Archos using the user's key for this provider. */
export async function removeProviderKey(userId: string, provider: Provider): Promise<void> {
  await db.transaction((tx) => revokeActiveKey(tx, userId, provider, "removed"));
}

// A revoked key keeps its row for the audit trail, but the ciphertext is wiped
// so it cannot be recovered, even by someone holding the master key.
async function revokeActiveKey(
  tx: Transaction,
  userId: string,
  provider: Provider,
  reason: "replaced" | "removed",
): Promise<boolean> {
  const revoked = await tx
    .update(providerKeys)
    .set({ revokedAt: new Date(), ciphertext: Buffer.alloc(0) })
    .where(activeKey(userId, provider))
    .returning({ id: providerKeys.id, last4: providerKeys.last4 });

  for (const row of revoked) {
    await recordAudit(
      {
        actorId: userId,
        action: "key.revoked",
        targetType: "provider_key",
        targetId: row.id,
        metadata: { provider, last4: row.last4, reason },
      },
      tx,
    );
  }
  return revoked.length > 0;
}

/** Postgres unique_violation, possibly wrapped by Drizzle. */
function isUniqueViolation(error: unknown): boolean {
  const pgError = error instanceof Error && error.cause ? error.cause : error;
  return (pgError as { code?: string } | null)?.code === "23505";
}
