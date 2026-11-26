# Pickwinner

A Telegram bot for a group. The game and every reply are in Russian.

## Commands

- `/pwreg` — register.
- `/pw` — run the draw.
- `/pwstats` — top 10 for the current year.
- `/pwall` — top 10 of all time.
- `/pwme` — your own all-time count.
- `/pwrules` — the rules.

`/start` and `/help` list the commands. The game commands work in group chats. In a private chat or a channel the bot says the game is for groups only.

## The game

Each group has its own registered list, its own winners, and its own stats.

You register with `/pwreg`. You stay registered until you leave the group. You do not register again the next day. If you leave, you drop out of the draw and keep your score. If you join again, register again.

Only a registered player may run `/pw`. With one registered player the bot asks for another player, and that reply does not use up the day's draw.

There is one draw per Moscow day. The day resets at midnight Moscow (UTC+3). `/pwrules` says so. `/pw` picks one registered person at random, once two or more are registered. The draw is even, yesterday's winner can be picked again, and the person who ran `/pw` can win.

The first `/pw` of the day sends a short skit and a mention of the winner. A later `/pw` that day sends one line with the winner's name. It does not repeat the skit.

## Scores and stats

Every win is saved on the person's Telegram user id. The score stays with that id, so a changed username does not reset it.

Old totals can be loaded from a file as plain numbers.

The stats list people with a count above 0, and that includes people who left. They show the top 10, highest first, and end with the number of registered players. `/pwstats` counts the current year. `/pwall` counts all time. A person with no username is shown by first name.

## Maintenance

`npm run dev` does not play. It answers every command with a maintenance line. The part after `Попробуйте позже` is a spoiler. While it runs, the hosted bot does not receive commands.

## Stack

- TypeScript
- Node.js
- grammY
- Long polling on a developer machine, a webhook on Cloud Run
- Postgres (`DATABASE_URL`)
