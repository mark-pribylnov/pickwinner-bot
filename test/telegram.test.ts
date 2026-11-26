import assert from "node:assert/strict";
import test from "node:test";
import { commandMenu, memberViewFromStatus, telegramId } from "../src/telegram.js";

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
