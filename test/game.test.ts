import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { closePool, createPool, getPick, listPlayers, migrate } from "../src/db.js";
import { memberJoined, memberLeft, play, register, stats } from "../src/game.js";
import type { MemberView } from "../src/members.js";
import { testDatabaseUrl } from "./postgres.js";

let pool: Pool;

test.before(async () => {
  pool = createPool(await testDatabaseUrl());
  await migrate(pool);
});

test.after(async () => {
  if (pool) await closePool(pool);
});

const stay = (username: string, firstName: string): MemberView => ({
  state: "in",
  username,
  firstName,
});

test("one registered player does not use up the day", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  assert.equal(await register(pool, alex), "You're registered.");
  const reply = await play(pool, alex, {
    now: new Date("2026-11-24T12:00:00.000Z"),
    randomIndex: () => 0,
    lookup: async () => stay("alex", "Alex"),
  });
  assert.equal(reply, "You need another player to play the game.");
  assert.equal(await getPick(pool, chatId, "2026-11-24"), null);
});

test("an unregistered person cannot play", async () => {
  const chatId = randomUUID();
  await register(pool, { chatId, userId: "2", username: "sam", firstName: "Sam" });
  await register(pool, { chatId, userId: "3", username: "jordan", firstName: "Jordan" });
  const reply = await play(
    pool,
    { chatId, userId: "1", username: "alex", firstName: "Alex" },
    {
      now: new Date("2026-11-24T12:00:00.000Z"),
      randomIndex: () => 0,
      lookup: async (userId) => stay(userId, userId),
    },
  );
  assert.equal(reply, "Register before you can play.");
  assert.equal(await getPick(pool, chatId, "2026-11-24"), null);
});

test("the sender can be the fool, and a second play the same day does not change the score", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  const now = new Date("2026-11-24T12:00:00.000Z");
  const lookup = async (userId: string) => stay(userId === "1" ? "alex" : "sam", userId === "1" ? "Alex" : "Sam");
  assert.equal(
    await play(pool, alex, { now, randomIndex: () => 0, lookup }),
    "The fool is @alex.",
  );
  assert.equal(await play(pool, sam, { now, randomIndex: () => 0, lookup }), "A fool was already picked.");
  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("1")?.score, 1);
  assert.equal(players.get("2")?.score, 0);
});

test("a pick just before midnight UTC does not block the next date", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  const lookup = async (userId: string) =>
    stay(userId === "1" ? "alex" : "sam", userId === "1" ? "Alex" : "Sam");
  assert.equal(
    await play(pool, alex, {
      now: new Date("2026-11-24T23:59:00.000Z"),
      randomIndex: () => 0,
      lookup,
    }),
    "The fool is @alex.",
  );
  assert.equal(
    await play(pool, sam, {
      now: new Date("2026-11-25T00:01:00.000Z"),
      randomIndex: () => 1,
      lookup,
    }),
    "The fool is @sam.",
  );
});

test("leaving keeps the score, and rejoining does not register", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = '2'", [chatId]);
  await memberLeft(pool, chatId, "2");
  const reply = await play(pool, alex, {
    now: new Date("2026-11-24T12:00:00.000Z"),
    randomIndex: () => 0,
    lookup: async () => stay("alex", "Alex"),
  });
  assert.equal(reply, "You need another player to play the game.");
  await memberJoined(pool, { chatId, userId: "2", username: "samuel", firstName: "Samuel" });
  const afterJoin = (await listPlayers(pool, chatId)).find((player) => player.userId === "2");
  assert.equal(afterJoin?.registered, false);
  assert.equal(afterJoin?.score, 4);
  assert.equal(afterJoin?.username, "samuel");
  assert.equal(await register(pool, { chatId, userId: "2", username: "samuel", firstName: "Samuel" }), "You're registered.");
  const afterRegister = (await listPlayers(pool, chatId)).find((player) => player.userId === "2");
  assert.equal(afterRegister?.score, 4);
  assert.equal(afterRegister?.registered, true);
});

test("stats shows leavers and zeros without asking Telegram", async () => {
  const chatId = randomUUID();
  await register(pool, { chatId, userId: "2", username: "sam", firstName: "Sam" });
  await register(pool, { chatId, userId: "4", username: "riley", firstName: "Riley" });
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = '2'", [chatId]);
  await memberLeft(pool, chatId, "2");
  const text = await stats(pool, { chatId, userId: "4", username: "riley", firstName: "Riley" });
  assert.equal(text, "@sam — 4\n@riley — 0");
});

test("stats keeps the stored username until play refreshes it", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  assert.match(await stats(pool, sam), /@alex — 0/);
  await play(pool, alex, {
    now: new Date("2026-11-24T12:00:00.000Z"),
    randomIndex: () => 0,
    lookup: async (userId) => stay(userId === "1" ? "alexander" : "sam", userId === "1" ? "Alexander" : "Sam"),
  });
  assert.match(await stats(pool, sam), /@alexander — /);
});
