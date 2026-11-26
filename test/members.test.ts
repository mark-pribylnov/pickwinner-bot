import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { closePool, createPool, listPlayers, migrate, registerPlayer } from "../src/db.js";
import { reconcileRegistered } from "../src/members.js";
import { testDatabaseUrl } from "./postgres.js";

let pool: Pool;

test.before(async () => {
  pool = createPool(await testDatabaseUrl());
  await migrate(pool);
});

test.after(async () => {
  await closePool(pool);
});

test("reconcile drops leavers, keeps lookup failures, and refreshes names", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "out", username: "gone", firstName: "Gone" });
  await registerPlayer(pool, { chatId, userId: "bad", username: "bad", firstName: "Bad" });
  await registerPlayer(pool, { chatId, userId: "in", username: "old", firstName: "Old" });
  await pool.query("UPDATE players SET score = 4 WHERE chat_id = $1 AND user_id = 'out'", [chatId]);

  await reconcileRegistered(pool, chatId, async (userId) => {
    if (userId === "out") return { state: "out", username: "gone", firstName: "Gone" };
    if (userId === "bad") throw new Error("network");
    return { state: "in", username: "newname", firstName: "New" };
  });

  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("out")?.registered, false);
  assert.equal(players.get("out")?.score, 4);
  assert.equal(players.get("bad")?.registered, true);
  assert.equal(players.get("in")?.registered, true);
  assert.equal(players.get("in")?.username, "newname");
  assert.equal(players.get("in")?.score, 0);
});
