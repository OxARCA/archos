// Server-only module: never import from client components (kept free of the
// `server-only` guard so the Better Auth and drizzle CLIs can load it in plain Node).
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as appSchema from "./app-schema";
import * as authSchema from "./schema";

/**
 * Database access over the standard Postgres protocol (node-postgres).
 *
 * - Vercel: DATABASE_URL is Neon's pooled connection string, injected by the
 *   Marketplace integration. attachDatabasePool lets Fluid Compute close idle
 *   connections before an instance is suspended.
 * - Local: DATABASE_URL points at the embedded Postgres started by
 *   `npm run db:local`, or at any other Postgres.
 *
 * Without DATABASE_URL we return a Drizzle mock so `next build` can import
 * route modules while collecting page data. Queries against the mock throw,
 * so a running server still needs the real URL.
 */
// Better Auth's generated tables plus ours.
const schema = { ...authSchema, ...appSchema };

export type Database = NodePgDatabase<typeof schema>;

declare global {
  // Survive Next.js dev-server module reloads without opening a second pool.
  var __archosDb: Database | undefined;
}

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL is not set; database queries will fail (see .env.example).");
    return drizzle.mock({ schema }) as unknown as Database;
  }

  const pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 5_000 });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return drizzle({ client: pool, schema });
}

export const db: Database = globalThis.__archosDb ?? (globalThis.__archosDb = createDb());

export { schema };
