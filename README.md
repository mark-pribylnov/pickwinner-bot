# Pickwinner

A Telegram bot for a group. People join with `/register`. A registered player runs `/play`, and the bot names one registered person the fool. The group gets one successful pick per UTC day. `/stats` shows how many times each person has been picked, including people still at zero and people who have left.

The messages never say when the next pick opens.

## Requirements

- Node.js 22 or newer
- A Telegram bot token from BotFather
- Postgres, already running

The bot does not serve HTTP. It waits on Telegram with long polling.

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

Add the bot to a group and send `/register`.
