// A private Postgres server for running the app and its tests on your own computer,
// so nothing has to be installed. Hosted deployments use a real database (Neon) instead.
import { chownSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const LOCAL_PORT = 54329;
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(web, ".pgdata");

export const localUrl = (database) => `postgresql://postgres:postgres@localhost:${LOCAL_PORT}/${database}`;

/** True if DATABASE_URL points at the local server this script manages. */
export const isLocalUrl = (url) => typeof url === "string" && url.includes(`localhost:${LOCAL_PORT}`);

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
      .once("connect", () => socket.end(() => resolve(true)))
      .once("error", () => resolve(false));
  });
}

/** Starts the local server if it isn't already running. Returns a function that stops it (no-op if we didn't start it). */
export async function startLocalPostgres() {
  if (await portOpen(LOCAL_PORT)) return async () => {};

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  // Postgres refuses to run as root, so under root (Docker, CI sandboxes) the data folder must belong to the postgres user.
  if (process.getuid?.() === 0) {
    mkdirSync(dataDir, { recursive: true });
    const uid = Number(execFileSync("id", ["-u", "postgres"]).toString());
    const gid = Number(execFileSync("id", ["-g", "postgres"]).toString());
    chownSync(dataDir, uid, gid);
  }
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: LOCAL_PORT,
    persistent: true,
    onLog: () => {},
  });
  if (!existsSync(join(dataDir, "PG_VERSION"))) await server.initialise();
  // A server that was just stopped can hold its files for a moment; retry briefly before giving up.
  for (let attempt = 1; ; attempt++) {
    try {
      await server.start();
      break;
    } catch (err) {
      if (attempt >= 10) throw err ?? new Error("Could not start the local database");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return () => server.stop();
}

async function admin(url, fn) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  target.pathname = "/postgres";
  const client = new pg.Client({ connectionString: target.toString() });
  await client.connect();
  try {
    return await fn(client, name);
  } finally {
    await client.end();
  }
}

export function ensureDatabase(url) {
  return admin(url, async (client, name) => {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  });
}

/** Drops and recreates a throwaway database (used for the test database only). */
export function recreateDatabase(url) {
  return admin(url, async (client, name) => {
    if (!name.endsWith("_test")) throw new Error(`Refusing to recreate "${name}": only *_test databases`);
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}
