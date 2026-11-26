import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { closePool, createPool, getPick, listPlayers, migrate, tryRecordPick } from "../src/db.js";
import { allTimeStats, meStats, memberJoined, memberLeft, play, register, yearStats } from "../src/game.js";
import { textReply } from "../src/reply.js";
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
  assert.deepEqual(await register(pool, alex), textReply("Вы в игре."));
  assert.deepEqual(await register(pool, alex), textReply("Эй, ты уже в игре!"));
  const reply = await play(pool, alex, {
    now: new Date("2026-11-24T12:00:00.000Z"),
    randomIndex: () => 0,
    scriptIndex: () => 0,
    lookup: async () => stay("alex", "Alex"),
  });
  assert.deepEqual(reply, textReply("Нужен ещё один игрок."));
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
      scriptIndex: () => 0,
      lookup: async (userId) => stay(userId, userId),
    },
  );
  assert.deepEqual(reply, textReply("Сначала зарегистрируйтесь: /pwreg"));
  assert.equal(await getPick(pool, chatId, "2026-11-24"), null);
});

test("the sender can win, and a second draw the same day names them", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  const now = new Date("2026-11-24T12:00:00.000Z");
  const lookup = async (userId: string) => stay(userId === "1" ? "alex" : "sam", userId === "1" ? "Alex" : "Sam");
  const first = await play(pool, alex, { now, randomIndex: () => 0, scriptIndex: () => 0, lookup });
  assert.equal(first.kind, "skit");
  if (first.kind === "skit") {
    assert.equal(first.scriptIndex, 0);
    assert.equal(first.userId, "1");
    assert.equal(first.reveal.slice(first.mentionOffset, first.mentionOffset + first.mentionLength), "@alex");
  }
  const second = await play(pool, sam, { now, randomIndex: () => 0, scriptIndex: () => 3, lookup });
  assert.deepEqual(
    second,
    textReply("Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - alex!"),
  );
  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("1")?.score, 1);
  assert.equal(players.get("2")?.score, 0);
});

test("the game day turns over at Moscow midnight", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  const lookup = async (userId: string) =>
    stay(userId === "1" ? "alex" : "sam", userId === "1" ? "Alex" : "Sam");
  const before = await play(pool, alex, {
    now: new Date("2026-11-24T20:59:00.000Z"),
    randomIndex: () => 0,
    scriptIndex: () => 0,
    lookup,
  });
  assert.equal(before.kind, "skit");
  assert.equal((await getPick(pool, chatId, "2026-11-24"))?.userId, "1");
  const after = await play(pool, sam, {
    now: new Date("2026-11-24T21:00:00.000Z"),
    randomIndex: () => 1,
    scriptIndex: () => 0,
    lookup,
  });
  assert.equal(after.kind, "skit");
  assert.equal((await getPick(pool, chatId, "2026-11-25"))?.userId, "2");
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
    scriptIndex: () => 0,
    lookup: async () => stay("alex", "Alex"),
  });
  assert.deepEqual(reply, textReply("Нужен ещё один игрок."));
  await memberJoined(pool, { chatId, userId: "2", username: "samuel", firstName: "Samuel" });
  const afterJoin = (await listPlayers(pool, chatId)).find((player) => player.userId === "2");
  assert.equal(afterJoin?.registered, false);
  assert.equal(afterJoin?.score, 4);
  assert.equal(afterJoin?.username, "samuel");
  assert.deepEqual(
    await register(pool, { chatId, userId: "2", username: "samuel", firstName: "Samuel" }),
    textReply("Вы в игре."),
  );
  const afterRegister = (await listPlayers(pool, chatId)).find((player) => player.userId === "2");
  assert.equal(afterRegister?.score, 4);
  assert.equal(afterRegister?.registered, true);
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

test("a leaver with a pick this Moscow year is on the year board", async () => {
  const chatId = randomUUID();
  await register(pool, { chatId, userId: "1", username: "alex", firstName: "Alex" });
  await register(pool, { chatId, userId: "2", username: "sam", firstName: "Sam" });
  await tryRecordPick(pool, chatId, "2026-11-24", "2");
  await memberLeft(pool, chatId, "2");
  const actor = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const board = await yearStats(pool, actor, new Date("2026-11-27T12:00:00.000Z"));
  assert.equal(board.kind, "text");
  if (board.kind === "text") {
    assert.match(board.text, /1\. sam — 1 раз\(а\)/);
    assert.match(board.text, /Всего участников — 1/);
  }
});
