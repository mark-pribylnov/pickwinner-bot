# Pickwinner

A Telegram bot for a group. The game and every reply are in Russian.

- `/pidoreg` registers you. You stay registered until you leave the group.
- `/pidor` runs the draw. It needs at least two registered players, and the sender can win. The first draw of the day sends a short skit and a mention of the winner. A later `/pidor` that day sends one line with the winner's name.
- `/pidorstats` shows the top 10 for the current year.
- `/pidorall` shows the top 10 of all time.
- `/pidorme` shows your own all-time count.
- `/pidorules` shows the rules.

The game day is a Moscow day (UTC+3). It resets at midnight Moscow, and `/pidorules` says so. The score stays on the Telegram user id. The top 10 includes people who left, as long as their count is above 0.

`npm run dev` starts the bot in maintenance mode. It does not play. It answers every command with a maintenance line, and the part after `Попробуйте позже` is a spoiler.

`npm run import-history` loads old totals from `history.json` as numbers. `history.example.json` shows the shape.

## Requirements

- Node.js 22 or newer
- A Telegram bot token from BotFather
- Postgres, already running

On your machine the bot waits on Telegram with long polling. Leave `WEBHOOK_SECRET` unset for that. On Cloud Run, set `WEBHOOK_SECRET` and the service listens for Telegram at `/telegram`. `WEBHOOK_URL` is the Cloud Run address, without a path. The bot registers `<that address>/telegram`.

## Setup

```bash
npm install
cp .env.example .env
```

Put the token in `.env`.

Start Postgres with Docker:

```bash
docker compose up -d
```

Or, without Docker:

```bash
npm run db
```

Leave that process open. It prints `DATABASE_URL` and `TEST_DATABASE_URL`.

## Run

```bash
npm test
npm run dev
```

`npm test` uses `TEST_DATABASE_URL` when it is set. Otherwise it starts a local Postgres on port 54329 and uses the `pickwinner_test` database. Do not point `TEST_DATABASE_URL` at the database the bot uses.

`npm run dev` only answers with the maintenance line. To play, use the Cloud Run bot, or run `npm start` with `MAINTENANCE` unset after `npm run build`.

Add the bot to a group and send `/pidoreg`.

The hosted bot runs on Neon and Cloud Run. The screens, the two database strings, and the webhook variable are in [docs/hosting.md](docs/hosting.md).
