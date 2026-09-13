// Vitest global setup: a throwaway Postgres for tests that touch the database.
// It runs on a free port with its own temporary data folder, gets every
// migration in drizzle/, and is deleted when the test run ends.
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export default async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "archos-test-db-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port,
    user: "postgres",
    password: "postgres",
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase("archos_test");

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/archos_test`;
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  await pool.end();

  // Test workers start after this and inherit it.
  process.env.DATABASE_URL = url;

  return async () => {
    await pg.stop();
    await rm(dataDir, { recursive: true, force: true });
  };
}
