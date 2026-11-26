import { randomInt } from "node:crypto";
import type { Server } from "node:http";
import { maintenanceFrom, readConfig } from "./config.js";
import { closePool, createPool, migrate } from "./db.js";
import { loadEnvFile } from "./env.js";
import { createBot, startBot, startWebhook } from "./telegram.js";

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
  scriptIndex: (length) => randomInt(0, length),
  maintenance: maintenanceFrom(process.env),
});

let stopping = false;
let server: Server | null = null;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  } else {
    await bot.stop();
  }
  await closePool(pool);
}

process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});

if (config.webhook) {
  server = await startWebhook(bot, config.webhook);
  const address = server.address();
  const port = address && typeof address !== "string" ? address.port : config.webhook.port;
  console.log(
    config.webhook.url ? `webhook listening on ${port}` : `webhook listening on ${port}; WEBHOOK_URL is not set`,
  );
} else {
  await startBot(bot);
}
