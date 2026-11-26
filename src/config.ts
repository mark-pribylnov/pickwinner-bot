export type WebhookConfig = {
  secret: string;
  url: string | null;
  port: number;
};

export type AppConfig = {
  botToken: string;
  databaseUrl: string;
  webhook: WebhookConfig | null;
};

export function maintenanceFrom(env: NodeJS.ProcessEnv): boolean {
  return env.MAINTENANCE === "1";
}

const secretPattern = /^[A-Za-z0-9_-]{1,256}$/;

export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const botToken = env.BOT_TOKEN?.trim() ?? "";
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (botToken === "") throw new Error("BOT_TOKEN is required");
  if (databaseUrl === "") throw new Error("DATABASE_URL is required");

  const secret = env.WEBHOOK_SECRET?.trim() ?? "";
  const rawUrl = env.WEBHOOK_URL?.trim() ?? "";
  if (secret === "" && rawUrl === "") return { botToken, databaseUrl, webhook: null };
  if (secret === "") throw new Error("WEBHOOK_SECRET is required");
  if (!secretPattern.test(secret)) {
    throw new Error("WEBHOOK_SECRET must be 1-256 letters, digits, underscores, or hyphens");
  }

  return {
    botToken,
    databaseUrl,
    webhook: { secret, url: rawUrl === "" ? null : webhookUrl(rawUrl), port: portFrom(env.PORT) },
  };
}

function portFrom(value: string | undefined): number {
  const raw = value?.trim() || "8080";
  if (!/^\d+$/.test(raw)) throw new Error("PORT must be a number");
  const port = Number(raw);
  if (port < 1 || port > 65535) throw new Error("PORT must be a number");
  return port;
}

function webhookUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WEBHOOK_URL must be an https URL");
  }
  if (url.protocol !== "https:") throw new Error("WEBHOOK_URL must be an https URL");
  url.pathname = "/telegram";
  url.search = "";
  url.hash = "";
  return url.toString();
}
