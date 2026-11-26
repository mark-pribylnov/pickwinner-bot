import { randomInt } from "node:crypto";
import { readConfig } from "./config.js";
import { closePool, createPool, migrate } from "./db.js";
import { loadEnvFile } from "./env.js";
import { createBot, startBot } from "./telegram.js";

loadEnvFile(".env");

let config: ReturnType<typeof readConfig>;
try {
  config = readConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : "configuration failed");
  process.exit(1);
}

const pool = createPool(config.databaseUrl);
try {
  await migrate(pool);
} catch {
  console.error("database connection failed");
  process.exit(1);
}

const bot = createBot(config.botToken, {
  pool,
  now: () => new Date(),
  randomIndex: (length) => randomInt(0, length),
});

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await bot.stop();
  await closePool(pool);
}

process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});

await startBot(bot);
