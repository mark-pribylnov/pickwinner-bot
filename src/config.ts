export function readConfig(env: NodeJS.ProcessEnv): { botToken: string; databaseUrl: string } {
  const botToken = env.BOT_TOKEN?.trim() ?? "";
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  if (botToken === "") throw new Error("BOT_TOKEN is required");
  if (databaseUrl === "") throw new Error("DATABASE_URL is required");
  return { botToken, databaseUrl };
}
