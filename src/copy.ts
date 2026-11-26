import type { SpoilerReply } from "./reply.js";

export const copy = {
  registered: "You're registered.",
  alreadyRegistered: "You're already registered.",
  registerBeforePlay: "Register before you can play.",
  needAnotherPlayer: "You need another player to play the game.",
  alreadyPicked: "A fool was already picked.",
  noOneRegistered: "No one has registered.",
  addToGroup: "Add me to a group to play.",
  help: "/register — join the game\n/play — pick the fool\n/stats — show scores",
} as const;

export function foolAnnouncement(name: string): string {
  return `The fool is ${name}.`;
}

export const ru = {
  registered: "Вы в игре.",
  alreadyRegistered: "Вы уже в игре.",
  registerBeforePlay: "Сначала зарегистрируйтесь: /pidoreg",
  needAnotherPlayer: "Нужен ещё один игрок.",
  noOneRegistered: "Пока никто не зарегистрирован.",
  addToGroup: "Эта игра только для групповых чатов.",
  help: [
    "/pidoreg — зарегистрироваться",
    "/pidor — запустить розыгрыш",
    "/pidorstats — топ за текущий год",
    "/pidorall — топ за всё время",
    "/pidorme — личная статистика",
    "/pidorules — правила",
  ].join("\n"),
  rules: [
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
} as const;

const maintenanceText =
  "Прямо сейчас вносятся изменения в бота. Игра недоступна. Попробуйте позже или спросите разработчика, когда он закончит.";
const maintenanceHidden = "или спросите разработчика, когда он закончит.";

export function resultLine(name: string): string {
  return `Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - ${name}!`;
}

export function maintenanceMessage(): SpoilerReply {
  const offset = maintenanceText.lastIndexOf(maintenanceHidden);
  return { kind: "spoiler", text: maintenanceText, offset, length: maintenanceHidden.length };
}
