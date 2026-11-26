import { mkdir } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const port = 54329;
const user = "pickwinner";
const password = "pickwinner";
const database = "pickwinner_test";

let starting: Promise<string> | undefined;

export function testDatabaseUrl(): Promise<string> {
  if (process.env.TEST_DATABASE_URL) return Promise.resolve(process.env.TEST_DATABASE_URL);
  starting ??= startEmbedded();
  return starting;
}

async function startEmbedded(): Promise<string> {
  const databaseDir = path.join(process.cwd(), "data", "embedded-postgres");
  await mkdir(databaseDir, { recursive: true });
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  try {
    await postgres.initialise();
  } catch {
    // The cluster already exists from an earlier run.
  }
  try {
    await postgres.start();
    const child = (postgres as unknown as { process?: import("node:child_process").ChildProcess }).process;
    child?.stdin?.unref();
    child?.stdout?.unref();
    child?.stderr?.unref();
    child?.unref();
  } catch {
    // A cluster is already listening on this port.
  }
  await ensureDatabase("pickwinner");
  await ensureDatabase(database);
  return `postgres://${user}:${password}@localhost:${port}/${database}`;
}

async function ensureDatabase(name: string): Promise<void> {
  const client = new pg.Client({
    user,
    password,
    port,
    host: "localhost",
    database: "postgres",
  });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if ((existing.rowCount ?? 0) === 0) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
    }
  } finally {
    await client.end();
  }
}
