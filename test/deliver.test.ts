import assert from "node:assert/strict";
import test from "node:test";
import { deliver } from "../src/deliver.js";
import { buildSkit } from "../src/scripts.js";
import { maintenanceMessage } from "../src/copy.js";
import { skitPauseMs, textReply } from "../src/reply.js";

test("a skit sends four messages and waits between them", async () => {
  const skit = buildSkit(0, { username: "alex", firstName: "Alex", userId: "7" });
  const sent: { text: string; extra?: unknown }[] = [];
  const waits: number[] = [];
  await deliver(
    skit,
    async (text, extra) => {
      sent.push({ text, extra });
    },
    async (ms) => {
      waits.push(ms);
    },
    7,
  );
  assert.deepEqual(waits, [skitPauseMs, skitPauseMs, skitPauseMs]);
  assert.equal(sent.length, 4);
  assert.equal(sent[0]?.text, skit.lead[0]);
  assert.equal(sent[3]?.text, skit.reveal);
  assert.deepEqual(sent[3]?.extra, {
    entities: [
      {
        type: "text_mention",
        offset: skit.mentionOffset,
        length: skit.mentionLength,
        user: { id: 7, is_bot: false, first_name: "Alex" },
      },
    ],
  });
});

test("a skit without a Telegram id reveals as plain text", async () => {
  const skit = buildSkit(0, { username: "", firstName: "Alex", userId: "not-a-number" });
  const extras: unknown[] = [];
  await deliver(
    skit,
    async (_text, extra) => {
      extras.push(extra);
    },
    async () => {},
    null,
  );
  assert.equal(extras.length, 4);
  assert.equal(extras[3], undefined);
});

test("the maintenance reply uses a spoiler entity", async () => {
  const message = maintenanceMessage();
  let extra: unknown;
  await deliver(
    message,
    async (_text, given) => {
      extra = given;
    },
    async () => {},
  );
  assert.deepEqual(extra, {
    entities: [{ type: "spoiler", offset: message.offset, length: message.length }],
  });
});

test("plain text has no entities", async () => {
  let extra: unknown = "unset";
  await deliver(
    textReply("Вы в игре."),
    async (_text, given) => {
      extra = given;
    },
    async () => {},
  );
  assert.equal(extra, undefined);
});

test("no reply sends nothing", async () => {
  let sends = 0;
  await deliver(
    null,
    async () => {
      sends += 1;
    },
    async () => {},
  );
  assert.equal(sends, 0);
});
