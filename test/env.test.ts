import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadEnvFile } from "../src/env.js";

test("loadEnvFile fills missing keys and leaves existing ones", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pickwinner-env-"));
  const file = path.join(dir, ".env");
  await writeFile(file, "BOT_TOKEN=from-file\n# comment\nDATABASE_URL=postgres://db\n\n");
  const env: NodeJS.ProcessEnv = { BOT_TOKEN: "already" };
  loadEnvFile(file, env);
  assert.equal(env.BOT_TOKEN, "already");
  assert.equal(env.DATABASE_URL, "postgres://db");
});

test("loadEnvFile ignores a missing file", () => {
  const env: NodeJS.ProcessEnv = {};
  loadEnvFile("/tmp/pickwinner-missing-env-file", env);
  assert.deepEqual(env, {});
});
