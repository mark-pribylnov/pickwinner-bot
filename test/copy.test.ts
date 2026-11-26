import assert from "node:assert/strict";
import test from "node:test";
import { copy, foolAnnouncement, maintenanceMessage, resultLine, ru } from "../src/copy.js";

test("player-facing copy matches the design", () => {
  assert.equal(copy.registered, "You're registered.");
  assert.equal(copy.alreadyRegistered, "You're already registered.");
  assert.equal(copy.registerBeforePlay, "Register before you can play.");
  assert.equal(copy.needAnotherPlayer, "You need another player to play the game.");
  assert.equal(copy.alreadyPicked, "A fool was already picked.");
  assert.equal(copy.noOneRegistered, "No one has registered.");
  assert.equal(copy.addToGroup, "Add me to a group to play.");
  assert.equal(copy.help, "/register — join the game\n/play — pick the fool\n/stats — show scores");
  assert.equal(foolAnnouncement("alex"), "The fool is alex.");
});

test("player-facing copy does not reveal the reset time", () => {
  const hidden = /UTC|00:00|hour/i;
  for (const value of Object.values(copy)) {
    assert.doesNotMatch(value, hidden);
  }
  assert.doesNotMatch(foolAnnouncement("alex"), hidden);
});

test("russian copy matches the spec", () => {
  assert.equal(ru.registered, "Вы в игре.");
  assert.equal(ru.alreadyRegistered, "Вы уже в игре.");
  assert.equal(ru.registerBeforePlay, "Сначала зарегистрируйтесь: /pidoreg");
  assert.equal(ru.needAnotherPlayer, "Нужен ещё один игрок.");
  assert.equal(ru.noOneRegistered, "Пока никто не зарегистрирован.");
  assert.equal(ru.addToGroup, "Эта игра только для групповых чатов.");
  assert.equal(
    ru.help,
    [
      "/pidoreg — зарегистрироваться",
      "/pidor — запустить розыгрыш",
      "/pidorstats — топ за текущий год",
      "/pidorall — топ за всё время",
      "/pidorme — личная статистика",
      "/pidorules — правила",
    ].join("\n"),
  );
  assert.equal(
    ru.rules,
    [
      "Правила игры Пидор Дня (только для групповых чатов):",
      "1. Зарегистрируйтесь в игру по команде /pidoreg",
      "2. Подождите пока зарегистрируются все (или большинство :)",
      "3. Запустите розыгрыш по команде /pidor",
      "4. Просмотр статистики по команде /pidorstats, /pidorall",
      "5. Личная статистика по команде /pidorme",
      "",
      "Важно, розыгрыш проходит только раз в день, повторная команда выведет результат игры.",
      "",
      "Сброс розыгрыша происходит каждый день в 12 часов ночи по Москве (UTC+3).",
    ].join("\n"),
  );
  assert.equal(
    resultLine("mark_pribylnov"),
    "Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - mark_pribylnov!",
  );
});

test("the maintenance spoiler starts at или", () => {
  const message = maintenanceMessage();
  const hidden = "или спросите разработчика, когда он закончит.";
  assert.equal(message.kind, "spoiler");
  assert.equal(message.text.slice(message.offset, message.offset + message.length), hidden);
  assert.equal(message.text[message.offset - 1], " ");
  assert.equal(
    message.text,
    "Прямо сейчас вносятся изменения в бота. Игра недоступна. Попробуйте позже или спросите разработчика, когда он закончит.",
  );
});
