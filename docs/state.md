# Development state

This file is the current picture of the app. Update it in the same change as any behavior change. The rule is in `AGENTS.md`.

A spec in `docs/superpowers/specs/` is a plan. `2026-11-24-pickwinner-design.md` is what the first bot was built from. `2026-11-27-replace-sublime-design.md` is built. It replaced the English commands with the Russian draw. `docs/superpowers/plans/2026-11-27-replace-sublime.md` is the build log for that work. It still shows the old `/pidor` command names. Do not copy commands from it. The names in this file are the ones the bot uses.

## Has

- A Telegram group game on grammY and Postgres. Local `npm run dev` long-polls. Cloud Run receives commands at `/telegram`.
- Russian commands `/pwreg`, `/pw`, `/pwstats`, `/pwall`, `/pwme`, and `/pwrules`, plus `/start` and `/help`. The menu shows the six game commands, in Russian. All player-facing text is Russian.
- The game day is a Moscow date (UTC+3). It rolls at midnight Moscow. `/pwrules` says so. A year is the Moscow year.
- One winner per group per Moscow day. The draw is even among registered players, at least two, and the sender can win. The winner is saved before the reply.
- The first `/pw` of the day sends a short skit, then a reveal with a mention of the winner. A later `/pw` that day sends one result line that names the winner and skips the skit.
- A person registers once with `/pwreg` and stays registered until they leave. A second `/pwreg` while they are already registered answers `Эй, ты уже в игре!`. Leaving keeps the score and drops them from the draw. Joining again requires `/pwreg`. The score stays on the Telegram user id.
- Three stat views. `/pwstats` is the top 10 for the current year. `/pwall` is the top 10 of all time. `/pwme` is the sender's own all-time count. The top 10 lists people with a count above 0, leavers included, highest first, and ends with the number of registered players.
- Imported totals. `npm run import-history` reads `history.json` (see `history.example.json`) and stores each person's all-time and year count as numbers. The stats add them to the bot's own picks. The imported year count applies only to the year in the file.
- A private chat or a channel gets `Эта игра только для групповых чатов.` for the group commands. `/pwrules`, `/start`, and `/help` still answer.
- A failed command is written to the log and not sent to the chat.
- `npm run dev` runs with `MAINTENANCE=1`. It long-polls with the token in `.env`, does not play, saves nothing, and answers every command with the maintenance line. The part after `Попробуйте позже` is a spoiler. While it runs, Cloud Run does not receive commands. Stopping it does not register the webhook again.
- Group privacy stays enabled in BotFather (`/setprivacy` → **Enable**). The group member list shows **нет доступа к сообщениям**. The bot receives its own commands, replies to itself, mentions, and join/leave notices. It does not receive ordinary chat.

## Has not

- English commands `/register`, `/play`, and `/stats`.
- Admin removal of a player.
- Per-year commands for past years.
- Slap, me, shrug, or any other command beyond the list above.
- A key-value store, a notebook, or game releases.
- A second bot token.
- Access to every group message. BotFather privacy stays **Enable**. The member list must not say **имеет доступ к сообщениям**. The bot is not made a group admin to bypass that.
- An allowlist of groups. Every group that adds the bot plays, with its own roster and scores. What gets tight under a rush of groups is in `docs/hosting.md` under **Many groups**: one token, two Cloud Run instances, the skit holding the webhook request, and Neon's connection limit.

## Planned

Nothing is planned.
