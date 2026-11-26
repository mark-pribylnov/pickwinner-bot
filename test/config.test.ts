import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.js";

test("readConfig requires the token and the database url", () => {
  assert.throws(() => readConfig({}), /BOT_TOKEN is required/);
  assert.throws(() => readConfig({ BOT_TOKEN: "token" }), /DATABASE_URL is required/);
  assert.deepEqual(readConfig({ BOT_TOKEN: " token ", DATABASE_URL: " postgres://db " }), {
    botToken: "token",
    databaseUrl: "postgres://db",
  });
});
