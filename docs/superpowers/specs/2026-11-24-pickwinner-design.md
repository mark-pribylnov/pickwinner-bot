# Pickwinner design

A Telegram group bot that names one fool and keeps a score for each person. The behavior in `bot-description.md` is agreed. This document is what a builder needs to plan the first version.

## Intent

People in a Telegram group opt into a game. Once per UTC day, a registered player can run `/play`. The bot picks one registered person at random and announces them as the fool. The person who ran the command can be the one picked. The group can see how many times each person has been the fool, including people still at zero and people who have left.

The score belongs to Telegram's user id. A new username does not create a new score.

## Goals

- A standing roster: a person registers once and stays registered while they remain in the group.
- One successful pick per group per UTC day, with the day boundary fixed at 00:00 UTC.
- A uniform draw among whoever is registered at that moment, with at least two registered players.
- Scores that survive leaving, rejoining, and username changes.
- `/stats` for anyone, showing registered people and leavers.

## Non-goals

- No website, no Express server, no public URL.
- No sleeping or serverless host. The process stays running.
- No Telegram admin title, pin, or role for the fool. The label is the announcement message.
- No way to leave the game except leaving the group.
- No rule that yesterday's fool is skipped.
- No per-player cooldown. The one pick is for the whole group.
- No private-chat version of the game.
- No command that tells players when the next pick opens.
- No deployment to a specific host. The operator runs the process wherever it can stay on.

## Anti-goals

These would make the bot a failure even if the commands reply:

- Starting a 24-hour timer from a successful pick, or telling players the reset time.
- Counting a refused `/play` as the day's pick.
- Picking someone who is not registered, or picking when fewer than two people are registered.
- Resetting a score because a username changed, or because the person left and came back.
- Registering someone again automatically when they rejoin the group.
- Treating a new username as a different player.

## Constraints

- TypeScript, Node.js, and grammY.
- Long polling. grammY calls Telegram and waits. There is one open call while the group is quiet.
- Postgres, reached through `DATABASE_URL`. Scores have to survive a restart. The bot does not embed the database. Postgres is already running before the process starts.
- The bot is used in groups and supergroups. Default Telegram privacy mode is enough: the bot needs commands aimed at it and service messages. It does not need to be a group admin.
- Player-facing text is English.
- The operator creates the bot in BotFather and provides the token. The software does not create the bot.

## Approaches

Three ways were considered.

**Long polling.** One Node process. grammY waits on Telegram. A quiet week is one idle connection, and the process stays started. No domain and no certificate.

**Express webhook.** Telegram calls a public HTTPS address. The process still stays started all week, and the operator has to run a certificate and a domain. The game has no pages.

**Webhook on a host that sleeps.** The code starts only when Telegram sends an update. A quiet week costs nothing while it sleeps. More accounts and more setup.

Long polling is the chosen runtime. The midnight boundary is a date comparison when someone runs `/play`, so nothing has to run at 00:00 UTC.

**SQLite file** was the first store paired with that runtime. The product owner chose **Postgres** instead. The bot still long-polls. Postgres runs as its own process, and the bot connects with `DATABASE_URL`.

## How the game behaves

### Commands

| Command | Who | What happens |
| --- | --- | --- |
| `/register` | Anyone in the group | Joins the draw. Stays in it until they leave the group. |
| `/play` | A registered player | Picks the fool when the rules below allow it. |
| `/stats` | Anyone | Shows scores for this group. |

Commands work with the bot's username suffix (`/play@BotName`). The bot replies in the group, in the same chat as the command.

In a private chat, and in a channel, every command gets the same reply: `Add me to a group to play.` No score is read or written there.

`/start` and `/help` reply with:

```
/register — join the game
/play — pick the fool
/stats — show scores
```

That text does not mention UTC or when the day resets. The same three commands are registered with Telegram as the bot's command menu.

### `/register`

The sender's Telegram user id is the identity.

- New person: create their row, score 0, registered. Reply `You're registered.`
- Already registered in this group: leave the score as it is. Reply `You're already registered.`
- Someone who left and came back: set them registered again, keep the existing score, store the username and first name from this message. Reply `You're registered.`

Registering does not pick a fool and does not change today's pick.

### `/play`

Handle it in this order. A refusal does not write a pick and does not change any score.

1. Refresh membership and names for this group (see Names and leaving).
2. If the sender is not registered, reply `Register before you can play.`
3. If fewer than two people are registered, reply `You need another player to play the game.`
4. If this group already has a successful pick dated today in UTC, reply `A fool was already picked.`
5. Otherwise pick one registered person with equal probability, including the sender and including whoever was picked on an earlier day. Save the pick and add 1 to that person's score in one transaction. Reply `The fool is {name}.`

`{name}` is that person's display name at the moment of the pick.

Two `/play` commands at the same time must produce one fool. The database transaction is the lock. The loser sees `A fool was already picked.`

Today's date is the UTC calendar date on the machine running the bot, `YYYY-MM-DD`. A successful pick stores that date. It does not store a timestamp plus 24 hours. The next UTC date is allowed even if the previous pick was one minute before midnight. Players are never told this.

### `/stats`

Reply with one line per person who has a row in this group: everyone who has ever registered here, whether they are registered now or have left, including score 0.

```
@samuel — 4
@alex — 2
Alex — 1
@riley — 0
```

Sort by score descending, then by display name ascending, case-insensitive. If nobody has ever registered, reply `No one has registered.`

`/stats` does not refresh names and does not change membership. It shows what is already stored. A quiet username change appears after the next `/play`, or when that person returns and the bot sees them.

### Names

Store `user id`, `username` (empty when they have none), and `first name` for each person.

Display name is `@` plus the username when they have one. Otherwise it is the first name. If Telegram ever omits the first name, show the user id.

Update the stored username and first name whenever an update gives us that user:

- The person sends `/register`, `/play`, or `/stats`.
- A join service message shows them coming back.
- `/play` looks up each registered person who is still in the group.

The score stays on the user id through all of those.

### Leaving and returning

While the process is running, a service message that someone left or was removed marks them not registered. The row and the score stay. They remain on `/stats`.

A join service message updates the stored name and does not register them.

`/play` also checks each registered person with Telegram before it applies the pick rules. Someone whose status is left or kicked is marked not registered. Their score stays. A network error, or an unclear answer, leaves them registered and keeps the stored name. A blip must not empty the roster.

Someone who left while the process was stopped can still be marked registered until the next `/play`. That `/play` drops them before it counts players or draws.

Returning with a different username changes the name on the existing row. The score stays. They are not in the draw until they run `/register` again.

### What one group knows

Every row is keyed by the group chat id and the Telegram user id. Two groups do not share a roster, a fool, or a score. The same person in two groups has two scores.

If the bot is removed and later added again, the saved rows for that group remain.

If Telegram upgrades the group to a supergroup, the chat id changes. The bot moves the players and picks onto the new id. A person who already exists on both ids keeps the higher score. A UTC date that already has a pick on the new id keeps that pick.

## Data

Postgres. Connection string from `DATABASE_URL`. Refuse to start when it is missing or the server cannot be reached. Use the `pg` driver and one pool for the process.

On startup, create the tables if they do not exist. No migration framework.

`players`

- `chat_id` text, not null
- `user_id` text, not null
- `username` text, not null, default `''`
- `first_name` text, not null
- `score` integer, not null, default 0
- `registered` boolean, not null, default false
- primary key `(chat_id, user_id)`

`picks`

- `chat_id` text, not null
- `utc_date` text, not null, `YYYY-MM-DD`
- `user_id` text, not null
- primary key `(chat_id, utc_date)`

Chat ids and user ids are stored as text so a large Telegram id cannot lose precision in JavaScript.

The pick insert and the score increment commit together. Insert the pick first. The primary key makes a second pick for the same group and UTC date fail. If the insert conflicts, roll back and reply `A fool was already picked.` A failed transaction leaves both the pick and the score unchanged.

Local development ships a Docker Compose file that runs Postgres and documents a `DATABASE_URL` for it. Production uses whatever Postgres the operator already runs. The same URL is the only configuration the bot needs for the database.

Database tests use `TEST_DATABASE_URL` and create the same tables. They do not use the production database.

## Process

- Token from `BOT_TOKEN`. Refuse to start when it is missing. Never write the token to the log or the database.
- grammY long polling via `bot.start()`.
- One process. On SIGINT and SIGTERM, stop polling and close the pool.
- Ask Telegram for `message` and `my_chat_member` updates. Leave and join service messages arrive on `message`. `my_chat_member` is so the bot notices when it is removed. Do not require `chat_member`, and do not require admin rights.
- Log command failures and Telegram errors. A failed `getChatMember` for one person does not abort `/play`.

## Calls made in this design

These were not spelled out by the product owner. They are fixed for the first version.

- Register command is `/register`. Replies are `You're registered.` and `You're already registered.`
- An unregistered `/play` replies `Register before you can play.`
- The day's refusal replies `A fool was already picked.`
- Empty `/stats` replies `No one has registered.`
- Private chats and channels get `Add me to a group to play.`
- `/start` and `/help` list the three commands and do not mention the reset.
- Stats sort is highest score first, then display name.
- Postgres through the `pg` driver. `DATABASE_URL` is required. Tables are created on startup if missing.
- A Docker Compose file runs Postgres for local development.
- Ids stored as text.
- Membership is corrected on leave messages while the process is up, and again at the start of every `/play`.
- A transient Telegram error does not unregister people.
- Tests cover the rules without calling Telegram. Pure checks (UTC date, display name, draw) do not need a database. Checks that write rows use `TEST_DATABASE_URL`: one pick per day, leave keeps the score, re-register keeps the score, username change keeps the score.

## Left to the builder

- File layout under `src/`, as long as the game rules can be tested without a live bot.
- Test runner. Node's built-in test runner is enough.
- TypeScript project settings, ESM, and the dev command that runs long polling.
- Wording of log lines.
- How the operator installs dependencies and starts the process, documented in a short README with `BOT_TOKEN` and `DATABASE_URL`.

## Builder notes

The draw, the UTC date check, and the registration flag are ordinary functions over the two tables. Telegram handlers should stay thin: turn an update into a database change and one reply.

Do not add a scheduler. Nothing runs at midnight.
