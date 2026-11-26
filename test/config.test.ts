import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";

test("readConfig requires the token and the database url", () => {
  assert.throws(() => readConfig({}), /BOT_TOKEN is required/);
  assert.throws(() => readConfig({ BOT_TOKEN: "token" }), /DATABASE_URL is required/);
  assert.deepEqual(readConfig({ BOT_TOKEN: " token ", DATABASE_URL: " postgres://db " }), {
    botToken: "token",
    databaseUrl: "postgres://db",
    webhook: null,
  });
});

test("readConfig stays on long polling unless a webhook secret is set", () => {
  assert.equal(readConfig({ BOT_TOKEN: "token", DATABASE_URL: "postgres://db", PORT: "8080" }).webhook, null);
});

test("readConfig listens for a webhook when the secret is set", () => {
  assert.deepEqual(
    readConfig({
      BOT_TOKEN: "token",
      DATABASE_URL: "postgres://db",
      WEBHOOK_SECRET: " abc_DEF-123 ",
    }),
    {
      botToken: "token",
      databaseUrl: "postgres://db",
      webhook: { secret: "abc_DEF-123", url: null, port: 8080 },
    },
  );
  assert.equal(
    readConfig({
      BOT_TOKEN: "token",
      DATABASE_URL: "postgres://db",
      WEBHOOK_SECRET: "secret",
      PORT: "9090",
      WEBHOOK_URL: "https://pickwinner-abc.europe-west1.run.app/ignored",
    }).webhook?.url,
    "https://pickwinner-abc.europe-west1.run.app/telegram",
  );
});

test("readConfig rejects a webhook url or secret Telegram will refuse", () => {
  const base = { BOT_TOKEN: "token", DATABASE_URL: "postgres://db", WEBHOOK_SECRET: "secret" };
  assert.throws(() => readConfig({ ...base, WEBHOOK_URL: "http://example.com" }), /WEBHOOK_URL must be an https URL/);
  assert.throws(() => readConfig({ ...base, WEBHOOK_URL: "not a url" }), /WEBHOOK_URL must be an https URL/);
  assert.throws(
    () => readConfig({ BOT_TOKEN: "token", DATABASE_URL: "postgres://db", WEBHOOK_URL: "https://example.com" }),
    /WEBHOOK_SECRET is required/,
  );
  assert.throws(() => readConfig({ ...base, WEBHOOK_SECRET: "has space" }), /WEBHOOK_SECRET/);
  assert.throws(() => readConfig({ ...base, PORT: "nope" }), /PORT must be a number/);
});
