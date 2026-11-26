import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { commandMenu, createBot, memberViewFromStatus, moveChat, telegramId } from "../src/telegram.js";

test("member status maps to in, out, or unknown", () => {
  assert.equal(memberViewFromStatus("left", {}).state, "out");
  assert.equal(memberViewFromStatus("kicked", { username: "sam" }).state, "out");
  assert.deepEqual(memberViewFromStatus("restricted", { first_name: "Alex" }), {
    state: "in",
    username: "",
    firstName: "Alex",
  });
  for (const status of ["creator", "administrator", "member"]) {
    assert.equal(memberViewFromStatus(status, {}).state, "in");
  }
  assert.equal(memberViewFromStatus("something-else", {}).state, "unknown");
  assert.equal(memberViewFromStatus("restricted", {}, { isMember: false }).state, "out");
  assert.equal(memberViewFromStatus("restricted", {}, { isMember: true }).state, "in");
});

test("telegram ids stay exact safe integers", () => {
  assert.equal(telegramId("42"), 42);
  assert.equal(telegramId("-1001234567890"), -1001234567890);
  assert.equal(telegramId("9007199254740993"), null);
  assert.equal(telegramId("01"), null);
  assert.equal(telegramId("nope"), null);
});

test("a maintenance-mode migration does not call the database", async () => {
  const pool = {
    connect: async () => {
      assert.fail("database should not be called");
    },
    query: async () => {
      assert.fail("database should not be called");
    },
  } as unknown as Pool;
  await moveChat(true, pool, 1, 2);
});

test("the command menu is the six russian commands", () => {
  assert.deepEqual(commandMenu, [
    { command: "pidor", description: "Запустить розыгрыш" },
    { command: "pidoreg", description: "Зарегистрироваться" },
    { command: "pidorstats", description: "Топ за текущий год" },
    { command: "pidorall", description: "Топ за всё время" },
    { command: "pidorme", description: "Личная статистика" },
    { command: "pidorules", description: "Правила игры" },
  ]);
});

function maintenanceBot() {
  const pool = {
    connect: async () => assert.fail("database should not be called"),
    query: async () => assert.fail("database should not be called"),
  } as unknown as Pool;
  const bot = createBot("123:abc", {
    pool,
    maintenance: true,
    now: () => new Date(),
    randomIndex: () => 0,
    scriptIndex: () => 0,
  });
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: "Bot",
    username: "pickwinner_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
  };
  const sent: string[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    if (method === "sendMessage") sent.push((payload as { text: string }).text);
    return { ok: true, result: true } as never;
  });
  return { bot, sent };
}

const from = { id: 5, is_bot: false, first_name: "Alex" };
const chat = { id: -100, type: "supergroup", title: "Group" } as const;

function commandUpdate(id: number, text: string) {
  return {
    update_id: id,
    message: {
      message_id: id,
      date: 0,
      chat,
      from,
      text,
      entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]!.length }],
    },
  } as never;
}

test("maintenance answers a command the bot does not handle", async () => {
  const { bot, sent } = maintenanceBot();
  await bot.handleUpdate(commandUpdate(1, "/slap"));
  await bot.handleUpdate(commandUpdate(2, "/pidor"));
  await bot.handleUpdate(commandUpdate(3, "/slap@someone_else_bot"));
  await bot.handleUpdate(commandUpdate(4, "/slap@pickwinner_bot"));
  assert.equal(sent.length, 3);
  assert.ok(sent.every((text) => text.startsWith("Прямо сейчас вносятся изменения")));
});

test("maintenance sends nothing for a join or a leave", async () => {
  const { bot, sent } = maintenanceBot();
  await bot.handleUpdate({
    update_id: 10,
    message: { message_id: 10, date: 0, chat, from, new_chat_members: [from] },
  } as never);
  await bot.handleUpdate({
    update_id: 11,
    message: { message_id: 11, date: 0, chat, from, left_chat_member: from },
  } as never);
  assert.deepEqual(sent, []);
});
