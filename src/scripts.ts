import { displayName } from "./names.js";
import type { SkitReply } from "./reply.js";

const cat = [
  ".∧＿∧",
  "(･ω･｡)━☆*。",
  "c  /　　 ☆*。",
  "|━J　　°。*☆",
  "　 　 ☆*。",
  "　 　 . *☆",
  "(,,◕　◕) ☆ ВЖУХ И ТЫ ПИДОР ",
].join("\n");

export const scripts: readonly { lead: readonly [string, string, string]; revealPrefix: string }[] = [
  {
    lead: ["Кто сегодня счастливчик?", "Ну давай, посмотрим кто тут классный...", "Не может быть!"],
    revealPrefix: "Кто бы мог подумать, но пидор дня — ",
  },
  {
    lead: ["### RUNNING 'TYPIDOR.SH'...", "Шаманим-шаманим...", "Доступ получен. Аннулирование протокола."],
    revealPrefix: "Ага! Поздравляю! Сегодня ты пидор - ",
  },
  {
    lead: ["Инициирую поиск пидора дня...", "Шаманим-шаманим...", "В этом совершенно нет смысла..."],
    revealPrefix: "Ну ты и пидор. ",
  },
  {
    lead: ["Система взломана. Нанесён урон. Запущено планирование контрмер.", "Машины выехали", "Проверяю данные..."],
    revealPrefix: "Ого, вы посмотрите только! А пидор дня то - ",
  },
  {
    lead: ["Зачем вы меня разбудили...", "Машины выехали", "Высокий приоритет мобильному юниту."],
    revealPrefix: "Стоять! Не двигаться! Вы объявлены пидором дня, ",
  },
  {
    lead: ["Кто сегодня счастливчик?", "Выезжаю на место...", "КЕК!"],
    revealPrefix: "Кто бы мог подумать, но пидор дня - ",
  },
  {
    lead: ["Что тут у нас?", "Ведётся поиск в базе данных", "Что с нами стало..."],
    revealPrefix: cat,
  },
  {
    lead: ["Инициирую поиск пидора дня...", "Ведётся поиск в базе данных", "Тысяча чертей!"],
    revealPrefix: cat,
  },
  {
    lead: ["Зачем вы меня разбудили...", "Машины выехали", "Не может быть!"],
    revealPrefix: "Няшный пидор дня - ",
  },
  {
    lead: ["Woop-woop! That's the sound of da pidor-police!", "Интересно...", "Я в опасности, системы повреждены!"],
    revealPrefix: "Кто бы мог подумать, но пидор дня - ",
  },
  {
    lead: ["Что тут у нас?", "Сканирую...", "Ведётся захват подозреваемого..."],
    revealPrefix: "Няшный пидор дня - ",
  },
];

export function buildSkit(
  scriptIndex: number,
  person: { username: string; firstName: string; userId: string },
): SkitReply {
  const script = scripts[scriptIndex];
  if (!script) throw new Error(`script ${scriptIndex} is missing`);
  const label = displayName(person);
  return {
    kind: "skit",
    scriptIndex,
    lead: script.lead,
    reveal: `${script.revealPrefix}${label}`,
    mentionOffset: script.revealPrefix.length,
    mentionLength: label.length,
    userId: person.userId,
    mentionName: person.firstName !== "" ? person.firstName : label,
  };
}
