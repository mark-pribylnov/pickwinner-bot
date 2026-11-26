import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { closePool, createPool, getPick, listPlayers, migrate } from "../src/db.js";
import { allTimeStats, meStats, memberJoined, memberLeft, play, register, stats, yearStats } from "../src/game.js";
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

test("year stats include the import only in that Moscow year", async () => {
  const chatId = randomUUID();
  await register(pool, { chatId, userId: "1", username: "mark_pribylnov", firstName: "Mark" });
  await register(pool, { chatId, userId: "2", username: "davidovich_sales", firstName: "Vlad" });
  await pool.query(
    `UPDATE players
     SET imported_all_time = 146, imported_year = 36, imported_for_year = 2026, score = 1
     WHERE chat_id = $1 AND user_id = '1'`,
    [chatId],
  );
  await pool.query(
    `INSERT INTO picks (chat_id, utc_date, user_id) VALUES ($1, '2026-11-24', '1')`,
    [chatId],
  );
  const actor = { chatId, userId: "2", username: "davidovich_sales", firstName: "Vlad" };
  const during = await yearStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  const after = await yearStats(pool, actor, new Date("2026-12-31T21:00:00.000Z"));
  assert.equal(during.kind, "text");
  assert.equal(after.kind, "text");
  if (during.kind === "text" && after.kind === "text") {
    assert.match(during.text, /1\. mark_pribylnov — 37 раз\(а\)/);
    assert.doesNotMatch(after.text, /mark_pribylnov/);
  }
  const all = await allTimeStats(pool, actor, new Date("2026-12-31T21:00:00.000Z"));
  const mine = await meStats(pool, { chatId, userId: "1", username: "mark_pribylnov", firstName: "Mark" });
  if (all.kind === "text") assert.match(all.text, /mark_pribylnov — 147 раз\(а\)/);
  if (mine.kind === "text") assert.equal(mine.text, "@mark_pribylnov, ты был(а) пидором дня — 147 раз!");
});

test("a leaver stays on the board and an empty chat does not", async () => {
  const chatId = randomUUID();
  const actor = { chatId, userId: "9", username: "nobody", firstName: "Nobody" };
  const empty = await meStats(pool, actor);
  assert.equal(empty.kind, "text");
  if (empty.kind === "text") assert.equal(empty.text, "@nobody, ты был(а) пидором дня — 0 раз!");
  const noRows = await yearStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  assert.equal(noRows.kind, "text");
  if (noRows.kind === "text") assert.equal(noRows.text, "Пока никто не зарегистрирован.");

  await register(pool, { chatId, userId: "2", username: "sam", firstName: "Sam" });
  await pool.query(
    "UPDATE players SET score = 4, registered = false WHERE chat_id = $1 AND user_id = '2'",
    [chatId],
  );
  const board = await allTimeStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  assert.equal(board.kind, "text");
  if (board.kind === "text") {
    assert.match(board.text, /sam — 4 раз\(а\)/);
    assert.match(board.text, /Всего участников — 0/);
  }
});
