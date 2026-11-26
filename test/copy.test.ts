import assert from "node:assert/strict";
import test from "node:test";
import { maintenanceMessage, resultLine, ru } from "../src/copy.js";

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
