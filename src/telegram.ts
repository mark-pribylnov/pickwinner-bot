import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Bot, webhookCallback, type Api, type Context } from "grammy";
import type { Pool } from "pg";
import { migrateChat } from "./db.js";
import { memberJoined, memberLeft, play, register, stats, type Actor } from "./game.js";
import type { MemberView } from "./members.js";
import { route } from "./route.js";

export const commandMenu = [
  { command: "register", description: "join the game" },
  { command: "play", description: "pick the fool" },
  { command: "stats", description: "show scores" },
] as const;

const inGroup = new Set(["creator", "administrator", "member", "restricted"]);

export function memberViewFromStatus(
  status: string,
  user: { username?: string; first_name?: string },
  options?: { isMember?: boolean },
): MemberView {
  const username = user.username ?? "";
  const firstName = user.first_name ?? "";
  if (status === "left" || status === "kicked") return { state: "out", username, firstName };
  if (status === "restricted" && options?.isMember === false) return { state: "out", username, firstName };
  if (inGroup.has(status)) return { state: "in", username, firstName };
  return { state: "unknown", username, firstName };
}

export function telegramId(id: string): number | null {
  if (!/^-?\d+$/.test(id)) return null;
  const value = Number(id);
  if (!Number.isSafeInteger(value) || String(value) !== id) return null;
  return value;
}

export type BotDeps = {
  pool: Pool;
  randomIndex: (length: number) => number;
  now: () => Date;
};

export function createBot(token: string, deps: BotDeps): Bot {
  const bot = new Bot(token);
  const depsFor = (chatId: string) => routeDeps(deps, bot.api, chatId);

  for (const command of ["start", "help", "register", "play", "stats"] as const) {
    bot.command(command, async (ctx) => {
      await reply(ctx, async () => {
        if (!ctx.chat || !ctx.from) return null;
        return route(
          {
            kind: "command",
            command,
            chatType: ctx.chat.type,
            actor: actorFrom(ctx.chat.id, ctx.from),
          },
          depsFor(String(ctx.chat.id)),
        );
      });
    });
  }

  bot.on("message:left_chat_member", async (ctx) => {
    await reply(ctx, async () => {
      const user = ctx.message?.left_chat_member;
      if (!ctx.chat || !user) return null;
      return route(
        {
          kind: "left",
          chatType: ctx.chat.type,
          chatId: String(ctx.chat.id),
          userId: String(user.id),
        },
        depsFor(String(ctx.chat.id)),
      );
    });
  });

  bot.on("message:new_chat_members", async (ctx) => {
    await reply(ctx, async () => {
      if (!ctx.chat) return null;
      for (const user of ctx.message?.new_chat_members ?? []) {
        await route(
          { kind: "joined", chatType: ctx.chat.type, actor: actorFrom(ctx.chat.id, user) },
          depsFor(String(ctx.chat.id)),
        );
      }
      return null;
    });
  });

  bot.on("message:migrate_to_chat_id", async (ctx) => {
    await moveChat(deps.pool, ctx.chat?.id, ctx.message?.migrate_to_chat_id);
  });

  bot.on("message:migrate_from_chat_id", async (ctx) => {
    await moveChat(deps.pool, ctx.message?.migrate_from_chat_id, ctx.chat?.id);
  });

  bot.on("my_chat_member", async () => {
    // Removing the bot keeps the saved rows.
  });

  return bot;
}

const allowedUpdates = ["message", "my_chat_member"] as const;

export async function startBot(bot: Bot): Promise<void> {
  await bot.api.setMyCommands([...commandMenu]);
  await bot.start({
    allowed_updates: [...allowedUpdates],
  });
}

export type WebhookListen = {
  secret: string;
  port: number;
  url: string | null;
};

export async function startWebhook(bot: Bot, options: WebhookListen): Promise<Server> {
  await bot.api.setMyCommands([...commandMenu]);
  const handle = webhookCallback(bot, "http", {
    secretToken: options.secret,
    timeoutMilliseconds: 50_000,
  });
  const server = createServer((req, res) => {
    void receive(handle, req, res);
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(options.port, "0.0.0.0", () => {
      server.off("error", onError);
      resolve();
    });
  });
  if (options.url) {
    await bot.api.setWebhook(options.url, {
      secret_token: options.secret,
      allowed_updates: [...allowedUpdates],
    });
  }
  return server;
}

async function receive(
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const path = (req.url ?? "").split("?")[0];
  try {
    if (req.method === "GET" && path === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("ok");
      return;
    }
    if (req.method === "POST" && path === "/telegram") {
      await handle(req, res);
      return;
    }
    if (!res.headersSent) res.writeHead(404).end();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "webhook failed");
    if (!res.headersSent) res.writeHead(500).end();
  }
}

function routeDeps(deps: BotDeps, api: Api, chatId: string) {
  return {
    register: (actor: Actor) => register(deps.pool, actor),
    play: (actor: Actor) =>
      play(deps.pool, actor, {
        now: deps.now(),
        randomIndex: deps.randomIndex,
        lookup: (userId) => lookupMember(api, chatId, userId),
      }),
    stats: (actor: Actor) => stats(deps.pool, actor),
    memberLeft: (id: string, userId: string) => memberLeft(deps.pool, id, userId),
    memberJoined: (actor: Actor) => memberJoined(deps.pool, actor),
  };
}

async function lookupMember(api: Api, chatId: string, userId: string): Promise<MemberView> {
  const numericChat = telegramId(chatId);
  const numericUser = telegramId(userId);
  if (numericChat === null || numericUser === null) {
    return { state: "unknown", username: "", firstName: "" };
  }
  try {
    const member = await api.getChatMember(numericChat, numericUser);
    const isMember = "is_member" in member ? member.is_member : undefined;
    return memberViewFromStatus(member.status, member.user, { isMember });
  } catch {
    return { state: "unknown", username: "", firstName: "" };
  }
}

function actorFrom(
  chatId: number | string,
  user: { id: number; username?: string; first_name: string },
): Actor {
  return {
    chatId: String(chatId),
    userId: String(user.id),
    username: user.username ?? "",
    firstName: user.first_name ?? "",
  };
}

async function moveChat(pool: Pool, fromId: number | undefined, toId: number | undefined): Promise<void> {
  if (fromId === undefined || toId === undefined) return;
  try {
    await migrateChat(pool, String(fromId), String(toId));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "chat migration failed");
  }
}

async function reply(ctx: Context, action: () => Promise<string | null>): Promise<void> {
  try {
    const text = await action();
    if (text) await ctx.reply(text);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "command failed");
  }
}
