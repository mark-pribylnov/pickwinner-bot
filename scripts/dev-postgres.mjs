import { mkdir } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const port = 54329;
const user = "pickwinner";
const password = "pickwinner";
const databaseDir = path.join(process.cwd(), "data", "embedded-postgres");

await mkdir(databaseDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
});

try {
  await postgres.initialise();
} catch {
  // The cluster already exists from an earlier run.
}

await postgres.start();

for (const name of ["pickwinner", "pickwinner_test"]) {
  const client = new pg.Client({ user, password, port, host: "localhost", database: "postgres" });
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

const host = `postgres://${user}:${password}@localhost:${port}`;
console.log(`DATABASE_URL=${host}/pickwinner`);
console.log(`TEST_DATABASE_URL=${host}/pickwinner_test`);
console.log("Postgres is running. Leave this process open.");
await new Promise(() => {});
