# Pickwinner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A grammY long-polling bot that registers group members, picks one fool per UTC day, and keeps scores in Postgres.

**Architecture:** Pure functions decide the draw, the UTC date, display names, and `/stats` text. A thin Postgres module stores players and picks. Game functions apply the command rules. grammY only turns Telegram updates into those calls and sends one reply.

**Tech Stack:** TypeScript, Node.js 22+, grammY, `pg`, Postgres 16, node:test via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-24-pickwinner-design.md`

## Global Constraints

- TypeScript, Node.js, grammY, long polling. No Express and no HTTP server.
- Postgres through `DATABASE_URL` using the `pg` driver. One pool. Tables created on startup if missing. No migration framework.
- Refuse to start when `BOT_TOKEN` or `DATABASE_URL` is missing, or when Postgres cannot be reached. Never write the token to the log or the database.
- Chat ids and user ids are text.
- Player-facing text is English and never mentions UTC, `00:00`, or when the next pick opens.
- `/register`, `/play`, `/stats` work in groups and supergroups, including the `@BotName` suffix grammY already accepts. Private chats and channels get `Add me to a group to play.`
- One successful pick per group per UTC calendar date. The pick insert and the score increment commit together. A second pick for that date conflicts and does not change the score.
- A refused `/play` does not write a pick and does not change a score.
- The draw is uniform among people registered after membership refresh, at least two, including the sender and including an earlier fool.
- Scores stay on the Telegram user id across leave, rejoin, and username changes. Rejoining does not register them.
- `/stats` lists everyone who has ever registered in that group, including score 0 and leavers, highest score first, then display name. It does not call Telegram.
- Display name is `@username` when they have one, otherwise first name, otherwise the user id.
- On `/play`, refresh each registered person. `left` or `kicked` unregisters them. Any other failure leaves them registered. One failed lookup does not abort the command.
- The bot does not need to be an admin. Ask Telegram for `message` and `my_chat_member` updates. Removing the bot does not delete rows.
- Nothing runs at midnight.
- Database tests use `TEST_DATABASE_URL` and must not use the production database.

## Review Focus

These are the failures most likely to ship wrong. Each one has a test in the task that owns it.

- Two `/play` calls at the same time must produce one fool and one `A fool was already picked.`, with the score increased once. Task 3.
- A `getChatMember` failure must leave that person registered and still let `/play` finish. Task 4.
- Rejoining the group must keep the score and leave them unregistered until `/register`. Task 4.
- A pick stored on `2026-11-24` must not block a pick on `2026-11-25`, including `23:59` UTC then `00:01` UTC. Task 4.
- `/stats` must show leavers and zeros from stored rows and must not call the membership lookup. Task 4.

## File structure

- `src/copy.ts` — exact player-facing strings.
- `src/names.ts` — `displayName`.
- `src/dates.ts` — `utcDate`.
- `src/play.ts` — `decidePlay`.
- `src/stats.ts` — `formatStats`.
- `src/db.ts` — pool, `migrate`, player and pick queries.
- `src/members.ts` — `reconcileRegistered`.
- `src/game.ts` — `register`, `play`, `stats`, `memberLeft`, `memberJoined`.
- `src/config.ts` — `readConfig`.
- `src/telegram.ts` — map Telegram member status; create and start the bot.
- `src/route.ts` — group gate and command dispatch.
- `src/index.ts` — process entry.
- `test/*.test.ts` — node:test files.
- `docker-compose.yml` — Postgres 16 for operators who have Docker.
- `scripts/dev-postgres.mjs` — local Postgres when Docker is not installed. Dev-only. The bot still connects only through `DATABASE_URL`.
- `.env.example`, `.gitignore`, `README.md`, `package.json`, `tsconfig.json`.

---

### Task 1: Copy, names, and the UTC date

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/copy.ts`, `src/names.ts`, `src/dates.ts`
- Test: `test/copy.test.ts`, `test/names.test.ts`, `test/dates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `copy.registered` = `You're registered.`
  - `copy.alreadyRegistered` = `You're already registered.`
  - `copy.registerBeforePlay` = `Register before you can play.`
  - `copy.needAnotherPlayer` = `You need another player to play the game.`
  - `copy.alreadyPicked` = `A fool was already picked.`
  - `copy.noOneRegistered` = `No one has registered.`
  - `copy.addToGroup` = `Add me to a group to play.`
  - `copy.help` = `/register — join the game\n/play — pick the fool\n/stats — show scores`
  - `foolAnnouncement(name: string): string` → `The fool is ${name}.`
  - `displayName(person: { username: string; firstName: string; userId: string }): string`
  - `utcDate(now: Date): string` → `YYYY-MM-DD` in UTC.

- [ ] **Step 1: Write the failing tests**

`test/copy.test.ts` asserts every `copy` value above, `foolAnnouncement("alex")` equals `The fool is alex.`, and no copy value or fool announcement matches `/UTC|00:00|hour/i`.

`test/names.test.ts`:
- username `samuel` → `@samuel`
- username `""`, first name `Alex` → `Alex`
- username `""`, first name `""`, user id `42` → `42`

`test/dates.test.ts`:
- `2026-11-24T23:59:59.000Z` → `2026-11-24`
- `2026-11-25T00:01:00.000Z` → `2026-11-25`

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --import tsx --test test/copy.test.ts test/names.test.ts test/dates.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the three modules**

`package.json`: `"type": "module"`, scripts `test` = `node --import tsx --test test/*.test.ts`, `dev` = `tsx src/index.ts`, `start` = `node dist/index.js`, `build` = `tsc`. Dependencies added in later tasks: `grammy`, `pg`. Dev: `tsx`, `typescript`, `@types/node`, `@types/pg`.

`tsconfig.json`: `strict`, `module` and `moduleResolution` `Node16`, `target` `ES2022`, `rootDir` `src`, `outDir` `dist`, `include` `["src"]`.

- [ ] **Step 4: Re-run the Task 1 tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/copy.ts src/names.ts src/dates.ts test/copy.test.ts test/names.test.ts test/dates.test.ts
git commit -m "feat: add player-facing copy, display names, and UTC dates"
```

### Task 2: Draw decision and stats text

**Files:**
- Create: `src/play.ts`, `src/stats.ts`
- Test: `test/play.test.ts`, `test/stats.test.ts`

**Interfaces:**
- Consumes: `displayName` from `src/names.ts`, `copy.noOneRegistered` from `src/copy.ts`.
- Produces:
  - `decidePlay(input: { senderRegistered: boolean; registeredUserIds: readonly string[]; alreadyPicked: boolean; randomIndex: (length: number) => number }): { ok: false; reason: "not_registered" | "need_another_player" | "already_picked" } | { ok: true; userId: string }`
  - `formatStats(rows: readonly { username: string; firstName: string; userId: string; score: number }[]): string`

`decidePlay` checks in this order: sender not registered, fewer than two ids, already picked, otherwise `registeredUserIds[randomIndex(length)]`. `randomIndex` is called only when a pick happens, with the list length.

`formatStats` sorts by score descending, then display name ascending with case-insensitive `localeCompare`. Lines are `${name} — ${score}` joined by `\n`. An empty list returns `copy.noOneRegistered`.

- [ ] **Step 1: Write the failing tests**

`decidePlay`:
- sender unregistered, ids `["a","b"]` → `not_registered`, and `randomIndex` is not called.
- sender registered, ids `["a"]` → `need_another_player`.
- sender registered, ids `["a","b"]`, `alreadyPicked` true → `already_picked`.
- `randomIndex` returns `0` → user `a`. Returns `1` → user `b`.

`formatStats` with samuel 4, alex 2, Alex (no username, first name Alex) 1, riley 0 equals:

```
@samuel — 4
@alex — 2
Alex — 1
@riley — 0
```

Empty rows equal `No one has registered.`

- [ ] **Step 2: Run `node --import tsx --test test/play.test.ts test/stats.test.ts`**

Expected: FAIL, modules missing.

- [ ] **Step 3: Implement `decidePlay` and `formatStats`.**

- [ ] **Step 4: Re-run those tests.** Expected: PASS.

- [ ] **Step 5: Commit** `feat: decide the draw and format stats`

### Task 3: Postgres

**Files:**
- Create: `src/db.ts`, `docker-compose.yml`, `docker/init-test-db.sql`, `scripts/dev-postgres.mjs`, `test/db.test.ts`
- Modify: `package.json` (add `pg`, `@types/pg`, and devDependency `embedded-postgres`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type PlayerRow = { chatId: string; userId: string; username: string; firstName: string; score: number; registered: boolean }`
  - `createPool(connectionString: string): Pool`
  - `migrate(pool: Pool): Promise<void>`
  - `closePool(pool: Pool): Promise<void>`
  - `registerPlayer(pool, person: { chatId: string; userId: string; username: string; firstName: string }): Promise<"created" | "already" | "reregistered">`
  - `updateProfile(pool, person): Promise<void>` — no-op when the row is absent; does not change `score` or `registered`.
  - `setRegistered(pool, chatId: string, userId: string, registered: boolean): Promise<void>`
  - `listPlayers(pool, chatId: string): Promise<PlayerRow[]>`
  - `getPick(pool, chatId: string, utcDate: string): Promise<{ userId: string } | null>`
  - `tryRecordPick(pool, chatId: string, utcDate: string, userId: string): Promise<"recorded" | "conflict">`

`tryRecordPick` inserts the pick first inside a transaction. A primary-key conflict rolls back and returns `"conflict"` without changing a score. A successful insert increments that player's score by 1 and commits. The player must already be registered; if the update matches nobody, roll back and throw.

`registerPlayer` keeps the existing score. `"created"` and `"reregistered"` end with `registered` true. `"already"` was already registered and stays registered. Username and first name are updated in all three.

Schema is the spec's `players` and `picks` tables. `registered` is boolean.

`docker-compose.yml` runs `postgres:16` with user, password, and database `pickwinner`, port `5432`. `docker/init-test-db.sql` creates database `pickwinner_test`.

`scripts/dev-postgres.mjs` starts `embedded-postgres` on port `54329` with the same user and password, creates `pickwinner` and `pickwinner_test`, and prints both URLs. It is the local path when Docker is not installed. The bot never imports it.

Tests read `TEST_DATABASE_URL`. Each test uses its own `chatId`. They delete only that chat's rows in `finally`, or truncate when the database is the dedicated test database. Truncate both tables at the start of the file so a rerun is clean, then use unique chat ids anyway.

- [ ] **Step 1: Write `test/db.test.ts`**

Cover:
- new register is `created`, score 0, registered.
- second register is `already`, score unchanged after a direct score update to 4, username replaced.
- unregister, register again is `reregistered`, score still 4.
- `updateProfile` on a missing user does not insert.
- `tryRecordPick` then `getPick` returns that user, score 1.
- second `tryRecordPick` the same date is `conflict`, score still 1.
- `tryRecordPick` on the next date is `recorded`.
- `Promise.all` of two `tryRecordPick` calls for the same date yields one `recorded` and one `conflict`, and the score is 1.
- two chat ids do not share a pick or a score.

- [ ] **Step 2: Run `node --import tsx --test test/db.test.ts` with `TEST_DATABASE_URL` set.** Expected: FAIL, module missing. Start Postgres first (`docker compose up -d` or `node scripts/dev-postgres.mjs`).

- [ ] **Step 3: Implement `src/db.ts` and the Postgres files.**

- [ ] **Step 4: Re-run the db tests.** Expected: PASS.

- [ ] **Step 5: Commit** `feat: store players and picks in Postgres`

### Task 4: Game rules over the database

**Files:**
- Create: `src/members.ts`, `src/game.ts`, `test/members.test.ts`, `test/game.test.ts`

**Interfaces:**
- Consumes: `decidePlay`, `formatStats`, `utcDate`, `displayName`, `copy`, `foolAnnouncement`, and the db functions.
- Produces:
  - `type MemberView = { state: "in" | "out" | "unknown"; username: string; firstName: string }`
  - `reconcileRegistered(pool, chatId: string, lookup: (userId: string) => Promise<MemberView>): Promise<void>`
  - `type Actor = { chatId: string; userId: string; username: string; firstName: string }`
  - `register(pool, actor: Actor): Promise<string>`
  - `play(pool, actor: Actor, opts: { now: Date; randomIndex: (length: number) => number; lookup: (userId: string) => Promise<MemberView> }): Promise<string>`
  - `stats(pool, actor: Actor): Promise<string>`
  - `memberLeft(pool, chatId: string, userId: string): Promise<void>`
  - `memberJoined(pool, actor: Actor): Promise<void>`

`reconcileRegistered` looks up only registered players. `"out"` sets registered false and does not change the score. `"in"` updates username and first name. `"unknown"` changes nothing. A thrown lookup is treated as `"unknown"` for that person and the loop continues.

`play` order: `updateProfile` for the sender (no-op if they have no row), `reconcileRegistered`, then `decidePlay` using the rows from after the refresh and `getPick` for `utcDate(now)`. On `ok`, `tryRecordPick`. `"conflict"` replies with `copy.alreadyPicked`. Success replies with `foolAnnouncement` of the chosen person's display name after the refresh.

`stats` calls `updateProfile` for the sender when they have a row, then `formatStats`. It does not take a lookup.

`memberLeft` sets registered false. `memberJoined` updates the profile when a row exists and does not set registered true. Neither inserts a new row.

- [ ] **Step 1: Write the failing tests**

`test/members.test.ts`: one `out`, one thrown lookup, one `in` with a new username. The `out` user is unregistered with the same score. The thrown user stays registered. The `in` user keeps the score and stores the new username.

`test/game.test.ts`:
- one registered player: `You need another player to play the game.` and `getPick` is null.
- unregistered sender with two other players: `Register before you can play.`
- two players, `randomIndex` returns the sender's index: `The fool is @alex.` and score 1. The same UTC day again: `A fool was already picked.` and score still 1.
- `now` `2026-11-24T23:59:00.000Z` records a pick; `now` `2026-11-25T00:01:00.000Z` can record another.
- leave keeps score 4, drops them from the draw, and a remaining single player gets the need-another-player reply. `memberJoined` with a new username does not register them. `/register` after that keeps score 4 and stores the new username.
- `/stats` after a leaver with score 4 and a registered player with score 0 includes both. The lookup spy is not used by `stats`.
- a group with a stored old username still shows it from `stats` until `play` refreshes `in`.

- [ ] **Step 2: Run the new tests.** Expected: FAIL, modules missing.

- [ ] **Step 3: Implement `members.ts` and `game.ts`.**

- [ ] **Step 4: Re-run Task 4 tests and the earlier suite.** Expected: PASS.

- [ ] **Step 5: Commit** `feat: apply register, play, stats, and membership rules`

### Task 5: Telegram process

**Files:**
- Create: `src/config.ts`, `src/route.ts`, `src/telegram.ts`, `src/index.ts`, `test/config.test.ts`, `test/route.test.ts`, `test/telegram.test.ts`, `.env.example`, `.gitignore`, `README.md`
- Modify: `package.json` to add `grammy`

**Interfaces:**
- Consumes: game functions, `copy`, `readConfig` result `{ botToken: string; databaseUrl: string }`.
- Produces:
  - `readConfig(env: NodeJS.ProcessEnv): { botToken: string; databaseUrl: string }` throws `BOT_TOKEN is required` or `DATABASE_URL is required`.
  - `isGroupChat(chatType: string | undefined): boolean` true only for `group` and `supergroup`.
  - `route(event, deps): Promise<string | null>`
  - `memberViewFromStatus(status: string, user: { username?: string; first_name?: string }): MemberView`
  - `telegramId(id: string): number | null` when `Number(id)` is a safe integer and `String(number) === id`.
  - `createBot(token: string, deps): Bot`
  - `startBot(bot: Bot): Promise<void>` calls `setMyCommands` for `register`, `play`, and `stats` with descriptions `join the game`, `pick the fool`, `show scores`, then `bot.start({ allowed_updates: ["message", "my_chat_member"] })`.

`route` events are `{ kind: "command"; command: string; chatType: string; actor: Actor }`, `{ kind: "left"; chatType: string; chatId: string; userId: string }`, and `{ kind: "joined"; chatType: string; actor: Actor }`.

Outside a group, a command returns `copy.addToGroup` and does not call game functions. `start` and `help` inside a group return `copy.help`. `register`, `play`, and `stats` dispatch. Any other command returns null. `left` and `joined` inside a group call the game functions and return null. Outside a group they return null without calling them.

`memberViewFromStatus`: `left` and `kicked` are `out`. `creator`, `administrator`, `member`, and `restricted` are `in`. Anything else is `unknown`. Username defaults to `""`, first name to `""`.

`createBot` maps grammY commands, `message:left_chat_member`, and `message:new_chat_members` through `route`. `my_chat_member` has no database effect. The `/play` lookup calls `getChatMember`. A thrown API call becomes `{ state: "unknown", username: "", firstName: "" }`. An id that fails `telegramId` also becomes `unknown`. Reply only when `route` returns a string. Unexpected handler errors are logged and not sent to the chat.

`src/index.ts` reads config, creates the pool, migrates, starts the bot, and on SIGINT and SIGTERM stops the bot and closes the pool. `randomIndex` is `randomInt(0, length)` from `node:crypto`.

`.env.example` lists `BOT_TOKEN`, `DATABASE_URL`, and `TEST_DATABASE_URL` with the local embedded-port values and the Docker port values in comments. `.gitignore` ignores `node_modules`, `dist`, `.env`, `data`, and `.superpowers`.

README: what the bot does, required env, Docker Compose path, `node scripts/dev-postgres.mjs` path, `npm test`, `npm run dev`. State that player-facing text does not reveal the reset time.

- [ ] **Step 1: Write failing tests for config, route, `memberViewFromStatus`, and `telegramId`.**

Route tests use a fake pool-free deps object whose game functions are spies, so they do not need Postgres. Private `/play` does not call `play`. Group `/start` returns the help text. Group `/play` calls `play`. A channel `/stats` returns the add-to-group text.

- [ ] **Step 2: Run those tests.** Expected: FAIL.

- [ ] **Step 3: Implement config, route, telegram, index, and the docs.**

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit** `feat: run the fool bot on Telegram long polling`

## Self-review notes

Spec sections map to tasks: commands and replies to Tasks 1, 4, and 5; UTC day and the non-rolling window to Tasks 1, 3, and 4; names and leaving to Tasks 1 and 4; Postgres schema and the single-pick transaction to Task 3; long polling, privacy, and the command menu to Task 5. No scheduler is added because no task creates one.
