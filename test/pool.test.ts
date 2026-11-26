import assert from "node:assert/strict";
import test from "node:test";
import { closePool, createPool } from "../src/db.js";

test("an idle Postgres error does not crash the process", async () => {
  const pool = createPool("postgres://pickwinner:pickwinner@127.0.0.1:1/pickwinner_test");
  assert.doesNotThrow(() => {
    pool.emit("error", new Error("connection reset"), pool);
  });
  await closePool(pool);
});
