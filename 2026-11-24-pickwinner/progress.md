# SDD ledger — plan: docs/superpowers/plans/2026-11-24-pickwinner.md

Ruling: git is not installed and sudo needs a password, so commit steps are skipped. The files in this workspace are the record. Cost if wrong: no commit history to review a range from.

Ruling: Docker is not installed. Local Postgres for tests and `npm run db` uses the `embedded-postgres` devDependency on port 54329. The bot still connects only through `DATABASE_URL`. `docker-compose.yml` stays for machines that have Docker. Cost if wrong: a developer with Docker uses Compose instead, and both speak Postgres.

Pre-flight: Task 2 consumes displayName and copy from Task 1. Task 4 consumes decidePlay, formatStats, utcDate, copy, and db from Tasks 1–3. Task 5 consumes game functions and copy. Signatures in the plan match across those tasks.

Task 1: complete (no commits, tests: node --import tsx --test test/copy.test.ts test/names.test.ts test/dates.test.ts → 4 pass)
Task 2: complete (no commits, tests: play and stats → 6 pass)
Task 3: complete (no commits, tests: test/db.test.ts → pass)
Task 4: complete (no commits, tests: members and game → pass)
Task 5: complete (no commits, tests: npm test → 35 pass, then 37 after review fixes)

Ruling: registered user ids are sorted before the draw so a test can point randomIndex at a person. A uniform randomIndex is still uniform. Cost if wrong: none for fairness.

Ruling: `.env` is loaded when the file exists, and an already-set variable wins. Cost if wrong: a shell variable overrides the file.

Ruling: `npm test` uses `--test-concurrency=1`. Two test files were starting Postgres at once. Cost if wrong: the suite is slower.

Final: Ruling: a leave and rejoin that both happen while the process is stopped stays registered if the person is back before the next `/play`. Telegram only shows the current status. Cost if wrong: they skip `/register` for that gap.

Final: Ruling: default privacy mode stands. Cost if wrong: the bot does not see ordinary chatter, which is the intended privacy mode.

Final: Ruling: `/play` asks Telegram about each registered person one at a time. Cost if wrong: a very large roster makes that command slow.

Final: Ruling: an unexpected error is logged and not sent to the chat. Cost if wrong: the command looks silent.

Final: Ruling: two first `/register` calls at the same moment may both say `You're registered.` Cost if wrong: none. The row is still one score.

Final: Ruling: a hung `getChatMember` waits on grammY's timeout. Cost if wrong: that one `/play` is slow.

Final: minor (deferred): no end-to-end test runs two `play()` calls at once. The database test already checks one score and one pick.

Final: minor (deferred): channel posts are not in `allowed_updates`, so a channel does not get `Add me to a group to play.`

Final: minor (deferred): an anonymous admin can register Telegram's anonymous-admin account.

Final: minor (deferred): `/stats` longer than 4096 characters fails in Telegram and is only logged.

Final: minor (deferred): two rows with the same score and display name have no user-id tiebreak.

Final: minor (deferred): `setMyCommands` failing at startup stops the process.

Final: minor (deferred): a database startup failure always logs `database connection failed`.

Final: minor (deferred): only the database tests refuse a `TEST_DATABASE_URL` that is not `pickwinner_test`.

Final: minor (deferred): the README does not spell out production `npm start`.

Final: fixed supergroup chat id migration — test `a supergroup upgrade keeps scores and the day's pick` RED→GREEN, suite 37/37.
Final: fixed idle Postgres client error — test `an idle Postgres error does not crash the process` RED→GREEN, suite 37/37.
Final: fixed restricted non-members staying in the draw — test `member status maps to in, out, or unknown` RED→GREEN, suite 37/37.

