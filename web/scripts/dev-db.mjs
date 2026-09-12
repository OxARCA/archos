#!/usr/bin/env node
/**
 * Local Postgres for development: real Postgres binaries installed from npm
 * (embedded-postgres), so no Docker, no sudo, no cloud account.
 *
 *   npm run db:local        start (first run initialises ./.postgres)
 *   Ctrl+C                  stop
 *   rm -rf .postgres        wipe all local data
 *
 * Matches DATABASE_URL in .env.example:
 *   postgresql://postgres:postgres@127.0.0.1:5433/archos
 */
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 5433);
const DB_NAME = "archos";
const DATA_DIR = path.resolve(".postgres");

// Postgres writes routine LOG lines to stderr; only surface real problems.
const important = (msg) => /\b(ERROR|FATAL|PANIC)\b/.test(String(msg));

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: "postgres",
  password: "postgres",
  persistent: true,
  onLog: () => {},
  onError: (msg) => {
    if (important(msg)) console.error(String(msg).trim());
  },
});

if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
  console.log(`Initialising a new Postgres cluster in ${DATA_DIR} ...`);
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase(DB_NAME);
  console.log(`Created database "${DB_NAME}".`);
} catch (err) {
  if (!String(err?.message ?? err).includes("already exists")) throw err;
}

console.log(`\nPostgres is running on 127.0.0.1:${PORT}`);
console.log(`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`);
console.log("Press Ctrl+C to stop.\n");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping Postgres ...");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive until a signal arrives.
setInterval(() => {}, 1 << 30);
