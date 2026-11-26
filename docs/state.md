# Development state

This file is the current picture of the app. Update it in the same change as any behavior change. The rule is in `AGENTS.md`.

A spec in `docs/superpowers/specs/` is a plan. `2026-11-24-pickwinner-design.md` is what the running bot was built from. `2026-11-27-replace-sublime-design.md` is approved and not built.

## Has

- A Telegram group game on grammY and Postgres. Local `npm run dev` long-polls. Cloud Run receives commands at `/telegram`.
- Commands `/register`, `/play`, `/stats`, `/start`, and `/help`. The menu shows the first three, in English.
- One winner per group per UTC date. The draw is even among registered players, at least two, and the sender can win. The winner is saved before the reply. A second `/play` that day gets `A fool was already picked.`
- A person registers once and stays registered until they leave. Leaving keeps the score and drops them from the draw. Joining again requires `/register`. The score stays on the Telegram user id.
- `/stats` lists every person who has a row, including score 0 and people who left. One lifetime number. Highest score first.
- One text reply per command. Player-facing text is English. A private chat or a channel gets `Add me to a group to play.`
- A failed command is written to the log and not sent to the chat.
- `npm run dev` calls `deleteWebhook` and long-polls with the token in `.env`. While it runs, Cloud Run does not receive commands. Stopping it does not register the webhook again.

## Has not

- Russian commands, Russian replies, or a command menu in Russian.
- A multi-message draw, a mention on the reveal, or a same-day result line that names the winner.
- A Moscow game day. The stored date is a UTC date.
- Year stats, all-time stats beside a year list, personal stats, or imported Sublime totals.
- A maintenance reply when `npm run dev` is running.
- Admin removal, a per-year command, slap, me, shrug, a key-value store, or game releases.

## Planned

Approved in `docs/superpowers/specs/2026-11-27-replace-sublime-design.md`. Not built. The implementation plan is `docs/superpowers/plans/2026-11-27-replace-sublime.md`.

- Replace the player-facing game with `/pidor`, `/pidoreg`, `/pidorstats`, `/pidorall`, `/pidorme`, and `/pidorules`. Text in Russian. English `/register`, `/play`, and `/stats` go away.
- The game day rolls at midnight Moscow (UTC+3). `/pidorules` says so.
- The first `/pidor` of the day saves the winner, then sends a short skit and a mention. A later `/pidor` that day sends one result line and skips the skit.
- Year top 10, all-time top 10, and a personal all-time count. Old Sublime totals load from a file as numbers, not as invented dates.
- `npm run dev` stays up, does not play, and answers every command with the maintenance line. The part after `Попробуйте позже` is a spoiler.
