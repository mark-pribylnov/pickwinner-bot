import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import {
  closePool,
  countPicksByUser,
  createPool,
  getPick,
  importTotals,
  listPlayers,
  migrate,
  migrateChat,
  registerPlayer,
  setRegistered,
  tryRecordPick,
  updateProfile,
} from "../src/db.js";
import { testDatabaseUrl } from "./postgres.js";

let pool: Pool;

test.before(async () => {
  const url = await testDatabaseUrl();
  const database = new URL(url).pathname;
  if (!database.endsWith("/pickwinner_test")) {
    throw new Error("TEST_DATABASE_URL must use the pickwinner_test database");
  }
  pool = createPool(url);
  await migrate(pool);
});

test.after(async () => {
  await closePool(pool);
});

test("register creates a player at score 0", async () => {
  const chatId = randomUUID();
  const result = await registerPlayer(pool, {
    chatId,
    userId: "1",
    username: "alex",
    firstName: "Alex",
  });
  assert.equal(result, "created");
  const [player] = await listPlayers(pool, chatId);
  assert.deepEqual(player, {
    chatId,
    userId: "1",
    username: "alex",
    firstName: "Alex",
    score: 0,
    registered: true,
    importedAllTime: 0,
    importedYear: 0,
    importedForYear: null,
  });
});

test("registering again keeps the score and replaces the username", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "alex", firstName: "Alex" });
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = $2", [chatId, "1"]);
  const result = await registerPlayer(pool, {
    chatId,
    userId: "1",
    username: "alexander",
    firstName: "Alexander",
  });
  assert.equal(result, "already");
  const [player] = await listPlayers(pool, chatId);
  assert.equal(player?.score, 4);
  assert.equal(player?.username, "alexander");
  assert.equal(player?.registered, true);
});

test("register after leaving keeps the score", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "sam", firstName: "Sam" });
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = $2", [chatId, "1"]);
  await setRegistered(pool, chatId, "1", false);
  const result = await registerPlayer(pool, {
    chatId,
    userId: "1",
    username: "samuel",
    firstName: "Samuel",
  });
  assert.equal(result, "reregistered");
  const [player] = await listPlayers(pool, chatId);
  assert.equal(player?.score, 4);
  assert.equal(player?.username, "samuel");
  assert.equal(player?.registered, true);
});

test("updateProfile does not insert a missing player", async () => {
  const chatId = randomUUID();
  await updateProfile(pool, { chatId, userId: "9", username: "nope", firstName: "Nope" });
  assert.deepEqual(await listPlayers(pool, chatId), []);
});

test("a pick is stored once per UTC date and increments the score once", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "alex", firstName: "Alex" });
  assert.equal(await tryRecordPick(pool, chatId, "2026-11-24", "1"), "recorded");
  assert.deepEqual(await getPick(pool, chatId, "2026-11-24"), { userId: "1" });
  assert.equal((await listPlayers(pool, chatId))[0]?.score, 1);

  assert.equal(await tryRecordPick(pool, chatId, "2026-11-24", "1"), "conflict");
  assert.equal((await listPlayers(pool, chatId))[0]?.score, 1);

  assert.equal(await tryRecordPick(pool, chatId, "2026-11-25", "1"), "recorded");
  assert.equal((await listPlayers(pool, chatId))[0]?.score, 2);
});

test("two simultaneous picks produce one score", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "alex", firstName: "Alex" });
  const results = await Promise.all([
    tryRecordPick(pool, chatId, "2026-11-24", "1"),
    tryRecordPick(pool, chatId, "2026-11-24", "1"),
  ]);
  results.sort();
  assert.deepEqual(results, ["conflict", "recorded"]);
  assert.equal((await listPlayers(pool, chatId))[0]?.score, 1);
});

test("a supergroup upgrade keeps scores and the day's pick", async () => {
  const fromChat = randomUUID();
  const toChat = randomUUID();
  await registerPlayer(pool, { chatId: fromChat, userId: "1", username: "alex", firstName: "Alex" });
  await registerPlayer(pool, { chatId: fromChat, userId: "2", username: "sam", firstName: "Sam" });
  await registerPlayer(pool, { chatId: toChat, userId: "1", username: "", firstName: "Alex" });
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = '1'", [fromChat]);
  await pool.query(
    "INSERT INTO picks (chat_id, utc_date, user_id) VALUES ($1, '2026-11-24', '1'), ($2, '2026-11-24', '1')",
    [fromChat, toChat],
  );

  await migrateChat(pool, fromChat, toChat);

  assert.deepEqual(await listPlayers(pool, fromChat), []);
  const moved = new Map((await listPlayers(pool, toChat)).map((player) => [player.userId, player]));
  assert.equal(moved.size, 2);
  assert.equal(moved.get("1")?.score, 4);
  assert.equal(moved.get("1")?.username, "alex");
  assert.equal(moved.get("1")?.registered, true);
  assert.equal(moved.get("2")?.username, "sam");
  assert.deepEqual(await getPick(pool, toChat, "2026-11-24"), { userId: "1" });
  assert.equal(await getPick(pool, fromChat, "2026-11-24"), null);
});

test("groups do not share picks or scores", async () => {
  const first = randomUUID();
  const second = randomUUID();
  await registerPlayer(pool, { chatId: first, userId: "1", username: "alex", firstName: "Alex" });
  await registerPlayer(pool, { chatId: second, userId: "1", username: "alex", firstName: "Alex" });
  await tryRecordPick(pool, first, "2026-11-24", "1");
  assert.equal(await getPick(pool, second, "2026-11-24"), null);
  assert.equal((await listPlayers(pool, second))[0]?.score, 0);
  assert.equal((await listPlayers(pool, first))[0]?.score, 1);
});

test("import writes totals once and does not reset score", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "7", username: "old", firstName: "Old", });
  await pool.query(
    "UPDATE players SET score = 4, registered = false WHERE chat_id = $1 AND user_id = '7'",
    [chatId],
  );
  const history = {
    chatId,
    year: 2026,
    players: [
      { userId: "7", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 },
      { userId: "8", username: "davidovich_sales", firstName: "Vlad", allTime: 161, yearCount: 35 },
    ],
  };
  await importTotals(pool, history);
  await importTotals(pool, history);
  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("7")?.score, 4);
  assert.equal(players.get("7")?.registered, false);
  assert.equal(players.get("7")?.importedAllTime, 146);
  assert.equal(players.get("7")?.importedYear, 36);
  assert.equal(players.get("7")?.importedForYear, 2026);
  assert.equal(players.get("7")?.username, "mark_pribylnov");
  assert.equal(players.get("8")?.score, 0);
  assert.equal(players.get("8")?.registered, true);
  assert.equal(players.get("8")?.importedAllTime, 161);
});

test("pick counts group by user for one year prefix", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "a", firstName: "A" });
  await registerPlayer(pool, { chatId, userId: "2", username: "b", firstName: "B" });
  await tryRecordPick(pool, chatId, "2026-11-24", "1");
  await tryRecordPick(pool, chatId, "2027-01-02", "2");
  const year = await countPicksByUser(pool, chatId, 2026);
  assert.equal(year.get("1"), 1);
  assert.equal(year.get("2"), undefined);
});

test("import keeps an existing name when the incoming name is empty", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "7", username: "mark", firstName: "Mark" });
  await importTotals(pool, {
    chatId,
    year: 2026,
    players: [{ userId: "7", username: "", firstName: "", allTime: 5, yearCount: 2 }],
  });
  const player = (await listPlayers(pool, chatId))[0];
  assert.equal(player?.username, "mark");
  assert.equal(player?.firstName, "Mark");
  assert.equal(player?.importedAllTime, 5);
});

test("a failed import writes no rows", async () => {
  const chatId = randomUUID();
  await assert.rejects(
    importTotals(pool, {
      chatId,
      year: 2026,
      players: [
        { userId: "1", username: "a", firstName: "A", allTime: 1, yearCount: 1 },
        { userId: "2", username: "b", firstName: "B", allTime: Number.NaN, yearCount: 1 },
      ],
    }),
  );
  assert.deepEqual(await listPlayers(pool, chatId), []);
});

test("a chat upgrade keeps the greater imported all-time total", async () => {
  const fromChat = randomUUID();
  const toChat = randomUUID();
  await registerPlayer(pool, { chatId: fromChat, userId: "1", username: "a", firstName: "A" });
  await registerPlayer(pool, { chatId: toChat, userId: "1", username: "a", firstName: "A" });
  await registerPlayer(pool, { chatId: fromChat, userId: "2", username: "b", firstName: "B" });
  await registerPlayer(pool, { chatId: toChat, userId: "2", username: "b", firstName: "B" });
  await pool.query("UPDATE players SET imported_all_time = 146 WHERE chat_id = $1 AND user_id = '1'", [fromChat]);
  await pool.query("UPDATE players SET imported_all_time = 100 WHERE chat_id = $1 AND user_id = '1'", [toChat]);
  await pool.query("UPDATE players SET imported_all_time = 10 WHERE chat_id = $1 AND user_id = '2'", [fromChat]);
  await pool.query("UPDATE players SET imported_all_time = 50 WHERE chat_id = $1 AND user_id = '2'", [toChat]);

  await migrateChat(pool, fromChat, toChat);

  const moved = new Map((await listPlayers(pool, toChat)).map((player) => [player.userId, player]));
  assert.equal(moved.get("1")?.importedAllTime, 146);
  assert.equal(moved.get("2")?.importedAllTime, 50);
});
