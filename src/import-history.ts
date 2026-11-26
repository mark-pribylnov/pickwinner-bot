import { readFile } from "node:fs/promises";
import { closePool, createPool, importTotals, migrate } from "./db.js";
import { loadEnvFile } from "./env.js";
import { parseHistory } from "./history.js";
import { readConfig } from "./config.js";

loadEnvFile(".env");
const config = readConfig(process.env);
const raw = await readFile(new URL("../history.json", import.meta.url), "utf8");
const pool = createPool(config.databaseUrl);
try {
  await migrate(pool);
  await importTotals(pool, parseHistory(raw));
} finally {
  await closePool(pool);
}
