import assert from "node:assert/strict";
import type { Server } from "node:http";
import test, { mock } from "node:test";
import type { Bot } from "grammy";
import { startWebhook } from "../src/telegram.js";

function fakeBot() {
  const setWebhook = mock.fn(async () => true);
  const setMyCommands = mock.fn(async () => true);
  const handleUpdate = mock.fn(async () => {});
  const bot = {
    api: { setWebhook, setMyCommands },
    isRunning: () => false,
    init: async () => {},
    handleUpdate,
  } as unknown as Bot;
  return { bot, setWebhook, setMyCommands, handleUpdate };
}

async function listen(bot: Bot, url: string | null, secret = "secret"): Promise<Server> {
  return startWebhook(bot, { secret, port: 0, url });
}

function origin(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("webhook server has no port");
  return `http://127.0.0.1:${address.port}`;
}

test("a webhook server answers health checks and rejects a bad secret", async () => {
  const { bot, setWebhook, setMyCommands, handleUpdate } = fakeBot();
  const server = await listen(bot, null);
  try {
    assert.equal(setWebhook.mock.calls.length, 0);
    assert.equal(setMyCommands.mock.calls.length, 1);
    const base = origin(server);
    const health = await fetch(`${base}/`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), "ok");

    const missing = await fetch(`${base}/telegram`, { method: "POST", body: "{}" });
    assert.equal(missing.status, 401);
    const wrong = await fetch(`${base}/telegram`, {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "nope" },
      body: "{}",
    });
    assert.equal(wrong.status, 401);
    const other = await fetch(`${base}/play`, { method: "POST", body: "{}" });
    assert.equal(other.status, 404);
    assert.equal(handleUpdate.mock.calls.length, 0);
  } finally {
    server.close();
  }
});

test("the right secret reaches the bot and startup registers the webhook", async () => {
  const { bot, setWebhook, handleUpdate } = fakeBot();
  const server = await listen(bot, "https://pickwinner-abc.europe-west1.run.app/telegram");
  try {
    assert.deepEqual(setWebhook.mock.calls[0]?.arguments, [
      "https://pickwinner-abc.europe-west1.run.app/telegram",
      { secret_token: "secret", allowed_updates: ["message", "my_chat_member"] },
    ]);
    const response = await fetch(`${origin(server)}/telegram`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "secret" },
      body: JSON.stringify({ update_id: 1 }),
    });
    assert.equal(response.status, 200);
    assert.equal(handleUpdate.mock.calls.length, 1);
  } finally {
    server.close();
  }
});
