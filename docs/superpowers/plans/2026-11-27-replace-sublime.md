# Replace Sublime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pickwinner the Russian daily draw this group already plays, on one bot token, with Sublime's totals loaded as numbers.

**Architecture:** Pure functions own the Moscow date, names, Russian copy, skit text, and stat lines. Postgres keeps one pick per Moscow date and stores imported totals beside `score`. `play` saves the winner before returning a skit or a result line. The Telegram layer waits and sends. `npm run dev` sets maintenance mode, which answers every command and does not touch the game.

**Tech Stack:** TypeScript, Node.js 22, grammY, Postgres via `pg`, Node's built-in test runner.

## Global Constraints

- Game date is the `Europe/Moscow` calendar date, `YYYY-MM-DD`. Midnight Moscow is 21:00 UTC. Store it in the existing `picks.utc_date` column. Do not rename the column.
- Commands players see: `/pidor`, `/pidoreg`, `/pidorstats`, `/pidorall`, `/pidorme`, `/pidorules`. Menu descriptions are Russian. `/start` and `/help` answer and are not in the menu.
- No `/register`, `/play`, `/stats`, `/pidormin`, `/pidorYYYY`, `/slap`, `/me`, `/shrug`, `/get`, `/set`, `/del`, `/releases`, donate link, or second bot token.
- One winner per group per Moscow date. Save the winner before sending. A later `/pidor` that day sends the result line and no skit.
- Result line: `Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - {plain name}!`
- Maintenance text, exact: `Прямо сейчас вносятся изменения в бота. Игра недоступна. Попробуйте позже или спросите разработчика, когда он закончит.` The spoiler covers `или спросите разработчика, когда он закончит.`
- `npm run dev` sets `MAINTENANCE=1`. `npm start` and Cloud Run do not. Maintenance still runs startup migration, then does not read or write the game.
- Imported totals are not pick rows. All-time is `imported_all_time + score`. The year list adds `imported_year` only when `imported_for_year` is the current Moscow year.
- The word in stat lines is always `раз(а)`. Top lists show at most 10 people, omit zeros, and keep leavers whose count is above 0. `Всего участников` is the registered count.
- Skit pause is 2000 ms between messages, not after the last. Tests do not wait on a real timer.
- Commits follow `AGENTS.md`: Conventional Commits, and the authorship rule when the agent commits.
- Do not deploy until Task 9. Tasks 1–6 leave the live commands in English.

## File structure

- `src/dates.ts` — `gameDate`, `gameYear`. `utcDate` stays until nothing calls it.
- `src/names.ts` — `plainName` for lists and the result line. `displayName` stays the mention label (`@username`, else first name, else id).
- `src/reply.ts` — reply values the game and Telegram share.
- `src/copy.ts` — Russian strings. English `copy` stays until Task 7 deletes it.
- `src/scripts.ts` — the 11 skits and `buildSkit`.
- `src/stats.ts` — board text and count math. English `formatStats` stays until Task 7.
- `src/db.ts` — import columns, `importTotals`, `countPicksByUser`.
- `src/history.ts` — parse `history.json`.
- `src/game.ts` — register, draw, three stat commands.
- `src/route.ts` — command names and `dispatch`.
- `src/deliver.ts` — turn a reply into sends and waits.
- `src/telegram.ts` — menu, handlers, maintenance short-circuit.
- `src/import-history.ts` — CLI.
- `history.example.json`, gitignored `history.json`.

---

### Task 1: Moscow game date

**Files:**
- Modify: `src/dates.ts`
- Test: `test/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `gameDate(now: Date): string`, `gameYear(now: Date): number`

- [ ] **Step 1: Write the failing test**

Add to `test/dates.test.ts`:

```ts
import { gameDate, gameYear } from "../src/dates.js";

test("gameDate rolls at midnight Moscow", () => {
  assert.equal(gameDate(new Date("2026-11-24T20:59:00.000Z")), "2026-11-24");
  assert.equal(gameDate(new Date("2026-11-24T21:00:00.000Z")), "2026-11-25");
  assert.equal(gameDate(new Date("2026-12-31T20:59:00.000Z")), "2026-12-31");
  assert.equal(gameDate(new Date("2026-12-31T21:00:00.000Z")), "2027-01-01");
});

test("gameYear is the Moscow calendar year", () => {
  assert.equal(gameYear(new Date("2026-12-31T20:59:00.000Z")), 2026);
  assert.equal(gameYear(new Date("2026-12-31T21:00:00.000Z")), 2027);
});
```

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test test/dates.test.ts`

Expected: FAIL, `gameDate` is not exported.

- [ ] **Step 3: Implement**

Add to `src/dates.ts`:

```ts
export function gameDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function gameYear(now: Date): number {
  return Number(gameDate(now).slice(0, 4));
}
```

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test test/dates.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dates.ts test/dates.test.ts
git commit -m "feat: add the Moscow game date"
```

---

### Task 2: Plain names

**Files:**
- Modify: `src/names.ts`
- Test: `test/names.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `plainName(person: { username: string; firstName: string; userId: string }): string`
- `displayName` remains the mention text and is not renamed.

- [ ] **Step 1: Write the failing test**

Add to `test/names.test.ts`:

```ts
import { displayName, plainName } from "../src/names.js";

test("plain name has no @ sign", () => {
  assert.equal(plainName({ username: "samuel", firstName: "Sam", userId: "1" }), "samuel");
  assert.equal(plainName({ username: "", firstName: "Alex", userId: "2" }), "Alex");
  assert.equal(plainName({ username: "", firstName: "", userId: "42" }), "42");
});
```

Keep the existing `displayName` test.

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test test/names.test.ts`

Expected: FAIL, `plainName` is not exported.

- [ ] **Step 3: Implement**

Add to `src/names.ts`:

```ts
export function plainName(person: {
  username: string;
  firstName: string;
  userId: string;
}): string {
  if (person.username !== "") return person.username;
  if (person.firstName !== "") return person.firstName;
  return person.userId;
}
```

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test test/names.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/names.ts test/names.test.ts
git commit -m "feat: add a plain display name"
```

---

### Task 3: Russian copy and the maintenance spoiler

**Files:**
- Create: `src/reply.ts`
- Modify: `src/copy.ts`
- Test: `test/copy.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TextReply = { kind: "text"; text: string }`
  - `SkitReply = { kind: "skit"; scriptIndex: number; lead: readonly [string, string, string]; reveal: string; mentionOffset: number; mentionLength: number; userId: string }`
  - `SpoilerReply = { kind: "spoiler"; text: string; offset: number; length: number }`
  - `Reply = TextReply | SkitReply | SpoilerReply`
  - `textReply(text: string): TextReply`
  - `skitPauseMs = 2000`
  - `ru` object, `resultLine(name: string): string`, `maintenanceMessage(): SpoilerReply`
- The English `copy` export stays so the live bot still compiles.

- [ ] **Step 1: Write the failing test**

Add to `test/copy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test test/copy.test.ts`

Expected: FAIL, `ru` is not exported.

- [ ] **Step 3: Implement**

Create `src/reply.ts`:

```ts
export type TextReply = { kind: "text"; text: string };

export type SkitReply = {
  kind: "skit";
  scriptIndex: number;
  lead: readonly [string, string, string];
  reveal: string;
  mentionOffset: number;
  mentionLength: number;
  userId: string;
  mentionName: string;
};

export type SpoilerReply = {
  kind: "spoiler";
  text: string;
  offset: number;
  length: number;
};

export type Reply = TextReply | SkitReply | SpoilerReply;

export const skitPauseMs = 2000;

export function textReply(text: string): TextReply {
  return { kind: "text", text };
}
```

Add to `src/copy.ts` without removing the English `copy` object:

```ts
import type { SpoilerReply } from "./reply.js";

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
```

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test test/copy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reply.ts src/copy.ts test/copy.test.ts
git commit -m "feat: add russian copy and the maintenance spoiler"
```

---

### Task 4: Skit scripts

**Files:**
- Create: `src/scripts.ts`
- Test: `test/scripts.test.ts`

**Interfaces:**
- Consumes: `SkitReply` from `src/reply.ts`, `displayName` from `src/names.ts`
- Produces: `scripts`, `buildSkit(scriptIndex: number, person: { username: string; firstName: string; userId: string }): SkitReply`

- [ ] **Step 1: Write the failing test**

Create `test/scripts.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildSkit, scripts } from "../src/scripts.js";

const alex = { username: "alex", firstName: "Alex", userId: "7" };
const noName = { username: "", firstName: "Саша", userId: "8" };

test("there are 11 scripts and the cat ones name the winner", () => {
  assert.equal(scripts.length, 11);
  for (const index of [6, 7]) {
    const skit = buildSkit(index, alex);
    assert.match(skit.reveal, /ВЖУХ И ТЫ ПИДОР/);
    assert.equal(skit.reveal.slice(skit.mentionOffset, skit.mentionOffset + skit.mentionLength), "@alex");
  }
});

test("a script mentions the winner at the end of the reveal", () => {
  const skit = buildSkit(0, alex);
  assert.equal(skit.kind, "skit");
  assert.equal(skit.scriptIndex, 0);
  assert.equal(skit.userId, "7");
  assert.equal(skit.lead[0], "Кто сегодня счастливчик?");
  assert.equal(skit.lead.length, 3);
  assert.equal(skit.reveal.slice(skit.mentionOffset), "@alex");
  assert.equal(skit.mentionLength, "@alex".length);
});

test("a winner with no username is mentioned by first name", () => {
  const skit = buildSkit(10, noName);
  assert.equal(skit.reveal.slice(skit.mentionOffset), "Саша");
  assert.equal(skit.lead[0], "Что тут у нас?");
});
```

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test test/scripts.test.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

Create `src/scripts.ts`:

```ts
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
```

The cat drawing is the one read from the 9 August and 13 August screenshots. Do not replace it with a different cat.

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test test/scripts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scripts.ts test/scripts.test.ts
git commit -m "feat: add the draw scripts"
```

---

### Task 5: Imported totals and pick counts

**Files:**
- Modify: `src/db.ts`
- Test: `test/db.test.ts`

**Interfaces:**
- Consumes: `PlayerRow` gains `importedAllTime: number`, `importedYear: number`, `importedForYear: number | null`
- Produces:
  - `importTotals(pool, history: HistoryImport): Promise<void>`
  - `countPicksByUser(pool, chatId: string, year: number): Promise<Map<string, number>>`
  - `HistoryImport` as below

```ts
export type HistoryImport = {
  chatId: string;
  year: number;
  players: Array<{
    userId: string;
    username: string;
    firstName: string;
    allTime: number;
    yearCount: number;
  }>;
};
```

- [ ] **Step 1: Write the failing test**

Add to `test/db.test.ts` and import `countPicksByUser` and `importTotals`:

```ts
test("import writes totals once and does not reset score", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "7", username: "old", firstName: "Old", });
  await pool.query(
    "UPDATE players SET score = 4, registered = false WHERE chat_id = $1 AND user_id = '7'",
    [chatId],
  );
  const history = {
    chatId,
    year: 2026,
    players: [
      { userId: "7", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 },
      { userId: "8", username: "davidovich_sales", firstName: "Vlad", allTime: 161, yearCount: 35 },
    ],
  };
  await importTotals(pool, history);
  await importTotals(pool, history);
  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("7")?.score, 4);
  assert.equal(players.get("7")?.registered, false);
  assert.equal(players.get("7")?.importedAllTime, 146);
  assert.equal(players.get("7")?.importedYear, 36);
  assert.equal(players.get("7")?.importedForYear, 2026);
  assert.equal(players.get("7")?.username, "mark_pribylnov");
  assert.equal(players.get("8")?.score, 0);
  assert.equal(players.get("8")?.registered, true);
  assert.equal(players.get("8")?.importedAllTime, 161);
});

test("pick counts group by user for one year prefix", async () => {
  const chatId = randomUUID();
  await registerPlayer(pool, { chatId, userId: "1", username: "a", firstName: "A" });
  await registerPlayer(pool, { chatId, userId: "2", username: "b", firstName: "B" });
  await tryRecordPick(pool, chatId, "2026-11-24", "1");
  await tryRecordPick(pool, chatId, "2027-01-02", "2");
  const year = await countPicksByUser(pool, chatId, 2026);
  assert.equal(year.get("1"), 1);
  assert.equal(year.get("2"), undefined);
});
```

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test --test-concurrency=1 test/db.test.ts`

Expected: FAIL, `importTotals` is not exported.

- [ ] **Step 3: Implement**

In `migrate`, after the two `CREATE TABLE` statements, run:

```ts
await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_all_time integer NOT NULL DEFAULT 0`);
await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_year integer NOT NULL DEFAULT 0`);
await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS imported_for_year integer`);
```

Also add the three columns to the `CREATE TABLE players` statement so a new database matches: `imported_all_time integer NOT NULL DEFAULT 0`, `imported_year integer NOT NULL DEFAULT 0`, `imported_for_year integer`.

Extend `PlayerRow` and `PlayerRecord`, and the `listPlayers` select and mapper, with those fields. `imported_for_year` comes back as `number | null`.

Add:

```ts
export async function importTotals(pool: pg.Pool, history: HistoryImport): Promise<void> {
  for (const player of history.players) {
    await pool.query(
      `INSERT INTO players (
         chat_id, user_id, username, first_name, score, registered,
         imported_all_time, imported_year, imported_for_year
       )
       VALUES ($1, $2, $3, $4, 0, true, $5, $6, $7)
       ON CONFLICT (chat_id, user_id) DO UPDATE
       SET username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           imported_all_time = EXCLUDED.imported_all_time,
           imported_year = EXCLUDED.imported_year,
           imported_for_year = EXCLUDED.imported_for_year`,
      [
        history.chatId,
        player.userId,
        player.username,
        player.firstName,
        player.allTime,
        player.yearCount,
        history.year,
      ],
    );
  }
}

export async function countPicksByUser(
  pool: pg.Pool,
  chatId: string,
  year: number,
): Promise<Map<string, number>> {
  const result = await pool.query<{ user_id: string; picks: number }>(
    `SELECT user_id, COUNT(*)::int AS picks
     FROM picks
     WHERE chat_id = $1 AND utc_date LIKE $2
     GROUP BY user_id`,
    [chatId, `${year}-%`],
  );
  return new Map(result.rows.map((row) => [row.user_id, Number(row.picks)]));
}
```

In `migrateChat`, when the destination row is updated from the source row, also set:

```sql
imported_all_time = GREATEST(destination.imported_all_time, source.imported_all_time),
imported_year = CASE
  WHEN destination.imported_for_year IS NOT NULL THEN destination.imported_year
  ELSE source.imported_year
END,
imported_for_year = COALESCE(destination.imported_for_year, source.imported_for_year)
```

The `UPDATE players SET chat_id` that moves leftover rows already carries the new columns.

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test --test-concurrency=1 test/db.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db.ts test/db.test.ts
git commit -m "feat: store imported totals beside the score"
```

---

### Task 6: Year, all-time, and personal stats

**Files:**
- Modify: `src/stats.ts`
- Modify: `src/game.ts`
- Test: `test/stats.test.ts`
- Test: `test/game.test.ts`

**Interfaces:**
- Consumes: `gameYear`, `plainName`, `textReply`, `ru`, `PlayerRow` import fields, `countPicksByUser`, `listPlayers`, `updateProfile`
- Produces:
  - `yearTotal({ importedYear, importedForYear, currentYear, picks }): number`
  - `allTimeTotal(importedAllTime: number, score: number): number`
  - `formatBoard(header: string, rows: { name: string; count: number }[], participants: number): string`
  - `meLine(person, count: number): string`
  - `yearStats(pool, actor, now: Date): Promise<Reply>`
  - `allTimeStats(pool, actor, now: Date): Promise<Reply>`
  - `meStats(pool, actor): Promise<Reply>`
- English `formatStats` and `stats()` stay until Task 7.

- [ ] **Step 1: Write the failing tests**

Add to `test/stats.test.ts`:

```ts
import { allTimeTotal, formatBoard, meLine, yearTotal } from "../src/stats.js";

test("year total drops the imported year after that year", () => {
  assert.equal(yearTotal({ importedYear: 36, importedForYear: 2026, currentYear: 2026, picks: 1 }), 37);
  assert.equal(yearTotal({ importedYear: 36, importedForYear: 2026, currentYear: 2027, picks: 2 }), 2);
  assert.equal(allTimeTotal(146, 1), 147);
});

test("the board is a top 10 with a participant count", () => {
  const rows = [
    { name: "zero", count: 0 },
    { name: "mark_pribylnov", count: 36 },
    { name: "davidovich_sales", count: 35 },
  ];
  assert.equal(
    formatBoard("Топ-10 пидоров за текущий год:", rows, 2),
    [
      "Топ-10 пидоров за текущий год:",
      "1. mark_pribylnov — 36 раз(а)",
      "2. davidovich_sales — 35 раз(а)",
      "",
      "Всего участников — 2",
    ].join("\n"),
  );
});

test("a board with only zeros still names the participants", () => {
  assert.equal(
    formatBoard("Топ-10 пидоров за все время:", [{ name: "alex", count: 0 }], 2),
    "Топ-10 пидоров за все время:\n\nВсего участников — 2",
  );
});

test("personal stats use the all-time count", () => {
  assert.equal(meLine({ username: "mark_pribylnov", firstName: "Mark", userId: "1" }, 146), "@mark_pribylnov, ты был(а) пидором дня — 146 раз!");
  assert.equal(meLine({ username: "", firstName: "Саша", userId: "2" }, 0), "Саша, ты был(а) пидором дня — 0 раз!");
});
```

Add to `test/game.test.ts`:

```ts
test("year stats include the import only in that Moscow year", async () => {
  const chatId = randomUUID();
  await register(pool, { chatId, userId: "1", username: "mark_pribylnov", firstName: "Mark" });
  await register(pool, { chatId, userId: "2", username: "davidovich_sales", firstName: "Vlad" });
  await pool.query(
    `UPDATE players
     SET imported_all_time = 146, imported_year = 36, imported_for_year = 2026, score = 1
     WHERE chat_id = $1 AND user_id = '1'`,
    [chatId],
  );
  await pool.query(
    `INSERT INTO picks (chat_id, utc_date, user_id) VALUES ($1, '2026-11-24', '1')`,
    [chatId],
  );
  const actor = { chatId, userId: "2", username: "davidovich_sales", firstName: "Vlad" };
  const during = await yearStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  const after = await yearStats(pool, actor, new Date("2026-12-31T21:00:00.000Z"));
  assert.equal(during.kind, "text");
  assert.equal(after.kind, "text");
  if (during.kind === "text" && after.kind === "text") {
    assert.match(during.text, /1\. mark_pribylnov — 37 раз\(а\)/);
    assert.doesNotMatch(after.text, /mark_pribylnov/);
  }
  const all = await allTimeStats(pool, actor, new Date("2026-12-31T21:00:00.000Z"));
  const mine = await meStats(pool, { chatId, userId: "1", username: "mark_pribylnov", firstName: "Mark" });
  if (all.kind === "text") assert.match(all.text, /mark_pribylnov — 147 раз\(а\)/);
  if (mine.kind === "text") assert.equal(mine.text, "@mark_pribylnov, ты был(а) пидором дня — 147 раз!");
});
```

Import `allTimeStats`, `meStats`, and `yearStats` from `../src/game.js`.

Add this test too. A leaver with a positive count stays on the board, and a chat with no rows gets the empty line:

```ts
test("a leaver stays on the board and an empty chat does not", async () => {
  const chatId = randomUUID();
  const actor = { chatId, userId: "9", username: "nobody", firstName: "Nobody" };
  const empty = await meStats(pool, actor);
  assert.equal(empty.kind, "text");
  if (empty.kind === "text") assert.equal(empty.text, "@nobody, ты был(а) пидором дня — 0 раз!");
  const noRows = await yearStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  assert.equal(noRows.kind, "text");
  if (noRows.kind === "text") assert.equal(noRows.text, "Пока никто не зарегистрирован.");

  await register(pool, { chatId, userId: "2", username: "sam", firstName: "Sam" });
  await pool.query(
    "UPDATE players SET score = 4, registered = false WHERE chat_id = $1 AND user_id = '2'",
    [chatId],
  );
  const board = await allTimeStats(pool, actor, new Date("2026-11-24T12:00:00.000Z"));
  assert.equal(board.kind, "text");
  if (board.kind === "text") {
    assert.match(board.text, /sam — 4 раз\(а\)/);
    assert.match(board.text, /Всего участников — 0/);
  }
});
```

- [ ] **Step 2: Run the tests**

Run: `node --import tsx --test --test-concurrency=1 test/stats.test.ts test/game.test.ts`

Expected: FAIL, `yearTotal` is not exported.

- [ ] **Step 3: Implement**

Add to `src/stats.ts`:

```ts
import { plainName } from "./names.js";
import { ru } from "./copy.js";

export function yearTotal(input: {
  importedYear: number;
  importedForYear: number | null;
  currentYear: number;
  picks: number;
}): number {
  const imported = input.importedForYear === input.currentYear ? input.importedYear : 0;
  return imported + input.picks;
}

export function allTimeTotal(importedAllTime: number, score: number): number {
  return importedAllTime + score;
}

export function formatBoard(
  header: string,
  rows: readonly { name: string; count: number }[],
  participants: number,
): string {
  const ranked = [...rows]
    .filter((row) => row.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name, "ru", { sensitivity: "base" });
    })
    .slice(0, 10)
    .map((row, index) => `${index + 1}. ${row.name} — ${row.count} раз(а)`);
  const body = ranked.length > 0 ? `${ranked.join("\n")}\n` : "";
  return `${header}\n${body}\nВсего участников — ${participants}`;
}

export function meLine(
  person: { username: string; firstName: string; userId: string },
  count: number,
): string {
  const name = person.username !== "" ? `@${person.username}` : plainName(person);
  return `${name}, ты был(а) пидором дня — ${count} раз!`;
}

export const yearHeader = "Топ-10 пидоров за текущий год:";
export const allTimeHeader = "Топ-10 пидоров за все время:";

export function emptyBoard(players: readonly unknown[]): string | null {
  return players.length === 0 ? ru.noOneRegistered : null;
}
```

Add to `src/game.ts`:

```ts
export async function yearStats(pool: Pool, actor: Actor, now: Date): Promise<Reply> {
  return board(pool, actor, now, "year");
}

export async function allTimeStats(pool: Pool, actor: Actor, now: Date): Promise<Reply> {
  return board(pool, actor, now, "all");
}

export async function meStats(pool: Pool, actor: Actor): Promise<Reply> {
  await updateProfile(pool, actor);
  const players = await listPlayers(pool, actor.chatId);
  const self = players.find((player) => player.userId === actor.userId);
  const count = self ? allTimeTotal(self.importedAllTime, self.score) : 0;
  return textReply(meLine(self ?? actor, count));
}

async function board(pool: Pool, actor: Actor, now: Date, which: "year" | "all"): Promise<Reply> {
  await updateProfile(pool, actor);
  const players = await listPlayers(pool, actor.chatId);
  const empty = emptyBoard(players);
  if (empty) return textReply(empty);
  const year = gameYear(now);
  const picks = which === "year" ? await countPicksByUser(pool, actor.chatId, year) : new Map<string, number>();
  const rows = players.map((player) => ({
    name: plainName(player),
    count:
      which === "year"
        ? yearTotal({
            importedYear: player.importedYear,
            importedForYear: player.importedForYear,
            currentYear: year,
            picks: picks.get(player.userId) ?? 0,
          })
        : allTimeTotal(player.importedAllTime, player.score),
  }));
  const participants = players.filter((player) => player.registered).length;
  const header = which === "year" ? yearHeader : allTimeHeader;
  return textReply(formatBoard(header, rows, participants));
}
```

Use the imports those functions need. Leave `stats()` and `formatStats` in place.

- [ ] **Step 4: Run the tests**

Run: `node --import tsx --test --test-concurrency=1 test/stats.test.ts test/game.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stats.ts src/game.ts test/stats.test.ts test/game.test.ts
git commit -m "feat: add year, all-time, and personal stats"
```

---

### Task 7: Switch the live commands

This is the commit that changes what players see. It removes the English commands.

**Files:**
- Modify: `src/game.ts`
- Modify: `src/route.ts`
- Modify: `src/copy.ts`
- Create: `src/deliver.ts`
- Modify: `src/telegram.ts`
- Modify: `src/index.ts`
- Modify: `src/config.ts`
- Modify: `package.json`
- Modify: `test/game.test.ts`
- Modify: `test/route.test.ts`
- Modify: `test/copy.test.ts`
- Modify: `test/telegram.test.ts`
- Modify: `test/config.test.ts`
- Create: `test/deliver.test.ts`

**Interfaces:**
- Consumes: `gameDate`, `buildSkit`, `scripts`, `resultLine`, `ru`, `plainName`, `displayName`, `maintenanceMessage`, `Reply`, `textReply`, `skitPauseMs`, `maintenanceFrom`
- Produces:
  - `play(pool, actor, opts): Promise<Reply>` with `opts.scriptIndex: (length: number) => number` beside `randomIndex`
  - `register(pool, actor): Promise<Reply>`
  - `dispatch({ maintenance, event }, deps): Promise<Reply | null>`
  - `deliver(reply, send, wait): Promise<void>`
  - `maintenanceFrom(env: NodeJS.ProcessEnv): boolean`
  - `commandMenu` is the six Russian commands
- Deletes: English `copy`, `foolAnnouncement`, `formatStats`, `stats`, and the `/register` `/play` `/stats` handlers.

`RouteDeps` becomes:

```ts
export type RouteDeps = {
  register: (actor: Actor) => Promise<Reply>;
  play: (actor: Actor) => Promise<Reply>;
  yearStats: (actor: Actor) => Promise<Reply>;
  allTimeStats: (actor: Actor) => Promise<Reply>;
  me: (actor: Actor) => Promise<Reply>;
  memberLeft: (chatId: string, userId: string) => Promise<void>;
  memberJoined: (actor: Actor) => Promise<void>;
};
```

- [ ] **Step 1: Write the failing tests**

Replace the English expectations in `test/game.test.ts`. Every `register()` assertion becomes `deepEqual` against `textReply("Вы в игре.")` or `textReply("Вы уже в игре.")`.

`one registered player does not use up the day`: the reply equals `textReply("Нужен ещё один игрок.")`. `getPick` still uses the Moscow date of that `now`. `play` calls pass `scriptIndex: () => 0`.

`an unregistered person cannot play`: the reply equals `textReply("Сначала зарегистрируйтесь: /pidoreg")`.

`the sender can be the fool...` becomes:

```ts
test("the sender can win, and a second pidor the same day names them", async () => {
  const chatId = randomUUID();
  const alex = { chatId, userId: "1", username: "alex", firstName: "Alex" };
  const sam = { chatId, userId: "2", username: "sam", firstName: "Sam" };
  await register(pool, alex);
  await register(pool, sam);
  const now = new Date("2026-11-24T12:00:00.000Z");
  const lookup = async (userId: string) => stay(userId === "1" ? "alex" : "sam", userId === "1" ? "Alex" : "Sam");
  const first = await play(pool, alex, { now, randomIndex: () => 0, scriptIndex: () => 0, lookup });
  assert.equal(first.kind, "skit");
  if (first.kind === "skit") {
    assert.equal(first.scriptIndex, 0);
    assert.equal(first.userId, "1");
    assert.equal(first.reveal.slice(first.mentionOffset, first.mentionOffset + first.mentionLength), "@alex");
  }
  const second = await play(pool, sam, { now, randomIndex: () => 0, scriptIndex: () => 3, lookup });
  assert.deepEqual(
    second,
    textReply("Согласно моей информации, по результатам сегодняшнего розыгрыша пидор дня - alex!"),
  );
  const players = new Map((await listPlayers(pool, chatId)).map((player) => [player.userId, player]));
  assert.equal(players.get("1")?.score, 1);
  assert.equal(players.get("2")?.score, 0);
});
```

Replace `a pick just before midnight UTC...` with a Moscow boundary. `2026-11-24T20:59:00.000Z` stores `2026-11-24`. `2026-11-24T21:00:00.000Z` stores `2026-11-25` and returns another skit. Both calls pass `scriptIndex: () => 0`.

In `leaving keeps the score...`, expect `textReply("Нужен ещё один игрок.")` and `textReply("Вы в игре.")` for the re-register. Pass `scriptIndex: () => 0` into `play`.

Delete the two English `stats()` tests (`stats shows leavers...` and `stats keeps the stored username...`). Task 6 already covers the Russian boards.

Replace `test/route.test.ts` with tests that:

- a private `/pidor` returns `textReply(ru.addToGroup)` and calls nothing
- a private `/pidorules`, `/start`, and `/help` return the rules or help text and call nothing
- a group `/pidor` calls `play`, `/pidoreg` calls `register`, `/pidorstats` calls `yearStats`, `/pidorall` calls `allTimeStats`, `/pidorme` calls `me`
- `dispatch({ maintenance: true, event: command }, deps)` returns `maintenanceMessage()` and calls nothing, for both `private` and `group`
- `dispatch` of a group leave while maintenance returns null and does not call `memberLeft`
- a group leave while not in maintenance still calls `memberLeft`

The spies return `textReply("ok")`.

Create `test/deliver.test.ts`:

```ts
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
```

Replace the menu test in `test/telegram.test.ts`:

```ts
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
```

Add to `test/config.test.ts`:

```ts
test("maintenance is on only for the exact flag", () => {
  assert.equal(maintenanceFrom({ MAINTENANCE: "1" }), true);
  assert.equal(maintenanceFrom({ MAINTENANCE: "true" }), false);
  assert.equal(maintenanceFrom({}), false);
});
```

Delete the English "does not reveal the reset time" test from `test/copy.test.ts`. Keep the Russian tests from Task 3.

- [ ] **Step 2: Run the tests**

Run: `node --import tsx --test --test-concurrency=1 test/game.test.ts test/route.test.ts test/deliver.test.ts test/telegram.test.ts test/config.test.ts`

Expected: FAIL, because `play` still returns a string and `deliver` does not exist.

- [ ] **Step 3: Implement the draw**

Replace `register` and `play` in `src/game.ts` with:

```ts
export async function register(pool: Pool, actor: Actor): Promise<Reply> {
  const result = await registerPlayer(pool, actor);
  return textReply(result === "already" ? ru.alreadyRegistered : ru.registered);
}

export async function play(
  pool: Pool,
  actor: Actor,
  opts: {
    now: Date;
    randomIndex: (length: number) => number;
    scriptIndex: (length: number) => number;
    lookup: (userId: string) => Promise<MemberView>;
  },
): Promise<Reply> {
  await updateProfile(pool, actor);
  await reconcileRegistered(pool, actor.chatId, opts.lookup);
  const players = await listPlayers(pool, actor.chatId);
  const sender = players.find((player) => player.userId === actor.userId);
  const registered = players
    .filter((player) => player.registered)
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const date = gameDate(opts.now);
  const existing = await getPick(pool, actor.chatId, date);
  const decision = decidePlay({
    senderRegistered: sender?.registered === true,
    registeredUserIds: registered.map((player) => player.userId),
    alreadyPicked: existing !== null,
    randomIndex: opts.randomIndex,
  });
  if (!decision.ok) {
    if (decision.reason === "not_registered") return textReply(ru.registerBeforePlay);
    if (decision.reason === "need_another_player") return textReply(ru.needAnotherPlayer);
    return textReply(resultLine(winnerName(players, existing?.userId ?? "")));
  }
  const chosen = registered.find((player) => player.userId === decision.userId);
  if (!chosen) throw new Error("draw selected a player who is not registered");
  const recorded = await tryRecordPick(pool, actor.chatId, date, chosen.userId);
  if (recorded === "conflict") {
    const winner = await getPick(pool, actor.chatId, date);
    return textReply(resultLine(winnerName(players, winner?.userId ?? chosen.userId)));
  }
  return buildSkit(opts.scriptIndex(scripts.length), chosen);
}

function winnerName(players: readonly PlayerRow[], userId: string): string {
  const player = players.find((row) => row.userId === userId);
  return player ? plainName(player) : userId;
}
```

Delete `stats` from `game.ts`. Add the imports `gameDate`, `resultLine`, `ru`, `textReply`, `buildSkit`, `scripts`, `plainName`, and `PlayerRow`.

- [ ] **Step 4: Implement routing**

Replace `src/route.ts` so `route` returns `Promise<Reply | null>`:

```ts
export async function route(event: RouteEvent, deps: RouteDeps): Promise<Reply | null> {
  if (event.kind === "command") {
    if (event.command === "start" || event.command === "help") return textReply(ru.help);
    if (event.command === "pidorules") return textReply(ru.rules);
    if (!isGroupChat(event.chatType)) return textReply(ru.addToGroup);
    if (event.command === "pidoreg") return deps.register(event.actor);
    if (event.command === "pidor") return deps.play(event.actor);
    if (event.command === "pidorstats") return deps.yearStats(event.actor);
    if (event.command === "pidorall") return deps.allTimeStats(event.actor);
    if (event.command === "pidorme") return deps.me(event.actor);
    return null;
  }
  if (!isGroupChat(event.chatType)) return null;
  if (event.kind === "left") {
    await deps.memberLeft(event.chatId, event.userId);
    return null;
  }
  await deps.memberJoined(event.actor);
  return null;
}

export async function dispatch(
  input: { maintenance: boolean; event: RouteEvent },
  deps: RouteDeps,
): Promise<Reply | null> {
  if (input.maintenance) {
    if (input.event.kind === "command") return maintenanceMessage();
    return null;
  }
  return route(input.event, deps);
}
```

- [ ] **Step 5: Implement delivery**

Create `src/deliver.ts`. It does not import `telegram.ts`. `telegram.ts` resolves the user id with `telegramId` and passes that number as `mentionId`. A null id sends the reveal as plain text. `first_name` on the entity is `reply.mentionName`.

```ts
import type { Reply } from "./reply.js";
import { skitPauseMs } from "./reply.js";

type Extra = { entities: unknown[] };

export async function deliver(
  reply: Reply | null,
  send: (text: string, extra?: Extra) => Promise<void>,
  wait: (ms: number) => Promise<void>,
  mentionId: number | null = null,
): Promise<void> {
  if (!reply) return;
  if (reply.kind === "text") {
    await send(reply.text);
    return;
  }
  if (reply.kind === "spoiler") {
    await send(reply.text, {
      entities: [{ type: "spoiler", offset: reply.offset, length: reply.length }],
    });
    return;
  }
  for (const line of reply.lead) {
    await send(line);
    await wait(skitPauseMs);
  }
  const extra =
    mentionId === null
      ? undefined
      : {
          entities: [
            {
              type: "text_mention",
              offset: reply.mentionOffset,
              length: reply.mentionLength,
              user: { id: mentionId, is_bot: false, first_name: reply.mentionName },
            },
          ],
        };
  await send(reply.reveal, extra);
}
```

`src/telegram.ts` `commandMenu`:

```ts
export const commandMenu = [
  { command: "pidor", description: "Запустить розыгрыш" },
  { command: "pidoreg", description: "Зарегистрироваться" },
  { command: "pidorstats", description: "Топ за текущий год" },
  { command: "pidorall", description: "Топ за всё время" },
  { command: "pidorme", description: "Личная статистика" },
  { command: "pidorules", description: "Правила игры" },
] as const;
```

Handlers listen for `start`, `help`, `pidoreg`, `pidor`, `pidorstats`, `pidorall`, `pidorme`, `pidorules`. Each calls `dispatch` with `maintenance: deps.maintenance`. Leave and join handlers do the same. `BotDeps` gains `scriptIndex: (length: number) => number` and `maintenance: boolean`. `routeDeps` passes `scriptIndex` into `play`, and wires `yearStats`, `allTimeStats`, and `me`.

`reply()` in `telegram.ts` becomes a call to `deliver`. The wait is `await new Promise((resolve) => setTimeout(resolve, ms))`. The send is `ctx.reply(text, extra)`.

`src/config.ts`:

```ts
export function maintenanceFrom(env: NodeJS.ProcessEnv): boolean {
  return env.MAINTENANCE === "1";
}
```

`src/index.ts` passes `scriptIndex: (length) => randomInt(0, length)` and `maintenance: maintenanceFrom(process.env)`.

`package.json` script:

```json
"dev": "MAINTENANCE=1 tsx src/index.ts"
```

Delete the English `copy` object and `foolAnnouncement` from `src/copy.ts`. Delete `formatStats` from `src/stats.ts` and its English tests.

- [ ] **Step 6: Run the tests and the type check**

Run: `npm test`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src test package.json
git commit -m "feat: switch the group commands to the russian draw"
```

---

### Task 8: History file

**Files:**
- Create: `src/history.ts`
- Create: `src/import-history.ts`
- Create: `history.example.json`
- Modify: `.gitignore`
- Modify: `package.json`
- Test: `test/history.test.ts`

**Interfaces:**
- Consumes: `HistoryImport`, `importTotals`, `migrate`, `createPool`, `closePool`, `readConfig`, `loadEnvFile`
- Produces: `parseHistory(raw: string): HistoryImport`

- [ ] **Step 1: Write the failing test**

Create `test/history.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseHistory } from "../src/history.js";

test("parseHistory reads the import file", () => {
  const history = parseHistory(
    JSON.stringify({
      chatId: "123",
      year: 2026,
      players: [
        { userId: "456", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 },
      ],
    }),
  );
  assert.equal(history.chatId, "123");
  assert.equal(history.players[0]?.allTime, 146);
});

test("parseHistory rejects a missing user id", () => {
  assert.throws(
    () =>
      parseHistory(
        JSON.stringify({
          chatId: "123",
          year: 2026,
          players: [{ userId: "", username: "mark_pribylnov", firstName: "Mark", allTime: 146, yearCount: 36 }],
        }),
      ),
    /userId/,
  );
});
```

- [ ] **Step 2: Run the test**

Run: `node --import tsx --test test/history.test.ts`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement**

Create `src/history.ts`:

```ts
import type { HistoryImport } from "./db.js";

export function parseHistory(raw: string): HistoryImport {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("history must be an object");
  const chatId = value.chatId;
  const year = value.year;
  const players = value.players;
  if (typeof chatId !== "string" || chatId === "") throw new Error("chatId is required");
  if (typeof year !== "number" || !Number.isInteger(year)) throw new Error("year must be an integer");
  if (!Array.isArray(players)) throw new Error("players must be a list");
  return {
    chatId,
    year,
    players: players.map((player) => {
      if (!isRecord(player)) throw new Error("player must be an object");
      const userId = player.userId;
      const username = player.username;
      const firstName = player.firstName;
      const allTime = player.allTime;
      const yearCount = player.yearCount;
      if (typeof userId !== "string" || !/^\d+$/.test(userId)) throw new Error("userId must be digits");
      if (typeof username !== "string" || typeof firstName !== "string") throw new Error("name must be a string");
      if (!isCount(allTime) || !isCount(yearCount)) throw new Error("counts must be integers");
      return { userId, username, firstName, allTime, yearCount };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
```

Create `src/import-history.ts`:

```ts
import { readFile } from "node:fs/promises";
import { closePool, createPool, importTotals, migrate } from "./db.js";
import { loadEnvFile } from "./env.js";
import { parseHistory } from "./history.js";
import { readConfig } from "./config.js";

loadEnvFile(".env");
const config = readConfig(process.env);
const raw = await readFile(new URL("../history.json", import.meta.url), "utf8");
const pool = createPool(config.databaseUrl);
try {
  await migrate(pool);
  await importTotals(pool, parseHistory(raw));
} finally {
  await closePool(pool);
}
```

Create `history.example.json` with empty `chatId` and empty `userId` values, `year` 2026, and the two known totals: `mark_pribylnov` 146 and 36, `davidovich_sales` 161 and 35. `firstName` is `""`.

Add `history.json` to `.gitignore`.

Add the script `"import-history": "tsx src/import-history.ts"` to `package.json`.

- [ ] **Step 4: Run the test**

Run: `node --import tsx --test test/history.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/history.ts src/import-history.ts history.example.json .gitignore package.json test/history.test.ts
git commit -m "feat: import sublime totals from a file"
```

---

### Task 9: Record the built state

**Files:**
- Modify: `docs/state.md`
- Modify: `README.md`
- Modify: `bot-description.md`

**Interfaces:**
- Consumes: the behavior from Tasks 1–8
- Produces: a state file whose Planned section says nothing is planned

- [ ] **Step 1: Update the docs**

`docs/state.md` Has lists the Russian commands, the Moscow day, the skit and the result line, the three stat views, imported totals, and maintenance mode on `npm run dev`. Has not lists admin removal, per-year commands, slap, me, shrug, the notebook, releases, a second bot token, and English `/register` `/play` `/stats`. Planned says `Nothing is planned.` The 2026-11-27 spec is described as built.

Replace the opening of `README.md` so it names `/pidoreg`, `/pidor`, `/pidorstats`, `/pidorall`, `/pidorme`, and `/pidorules`, the Moscow day, and the maintenance line on `npm run dev`. Delete the sentence that says the messages never reveal the reset. Keep the setup, Neon, and Cloud Run instructions.

Replace `bot-description.md` with the same player-facing rules: Russian commands, one draw per Moscow day, register until you leave, score on the user id, stats include leavers with a count above 0, and `npm run dev` does not play.

- [ ] **Step 2: Run the suite**

Run: `npm test`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add docs/state.md README.md bot-description.md
git commit -m "docs: record the russian draw as the current game"
```
