# Agent rules

## Development state

`docs/state.md` is the current picture of the app. It has three parts: what the app does, what it does not do, and what is planned. If nothing is planned, the planned part says so.

A spec in `docs/superpowers/specs/` is a plan. `docs/state.md` says which spec is built and which spec is approved and still unbuilt. When they disagree, `docs/state.md` is the one to follow.

Update `docs/state.md` in the same change as any player-facing or game-rule change.

- A behavior you add goes under what the app does, written the way a player would notice it.
- A behavior you remove leaves that section and, if it is worth remembering, goes under what the app does not do.
- A plan that is approved and not built goes under planned, with a link to its spec. Building it moves that entry into what the app does and removes it from planned.
- A plan that is dropped is removed from planned. It is not described as something the app does.
- Do not leave an entry for a behavior the code does not have.

Keep each entry short. Link the spec for the design. Do not paste the spec into `docs/state.md`.

## Hosting

Before guiding Neon, Cloud Run, Telegram webhooks, or a production env var, read `docs/hosting.md` and follow it one screen at a time. Name the site and the control. Say what the user should see before the next click. The user got lost when instructions skipped the screen they were looking at.

The running layout is Neon for Postgres and Cloud Run `pickwinner` in `europe-west1`, built from `main` on `mark-pribylnov/pickwinner-bot`. Local `npm run dev` long-polls. Cloud Run receives Telegram at `/telegram`.

Quote these controls. They are the ones that stalled the first setup:

- **Container image URL** means the form is "deploy an existing image." This repo has no image. Use **Connect repo** / **Continuously deploy new revisions from a source repository**, then **Cloud Build**. Leave the image URL empty.
- The build radio is **Go, Node.js, Python, Java, .NET Core, Ruby or PHP via Google Cloud's buildpacks**. Context directory `/`. Entrypoint empty. Function target empty. Branch `^main$`. The Dockerfile radio fails: there is no `Dockerfile`.
- **Security** blocks **Create** until **Service account** is the **Default compute service account** (`-compute@developer.gserviceaccount.com`). Binary Authorization stays off. Encryption stays **Google-managed encryption key**.
- The browser tab whose body is `ok` is `GET /` on the bot. It has no **Edit** control. Env vars are changed in the Cloud Run console: service `pickwinner`, **Containers**, **Variables & Secrets**, **Add variable**, then **View diff & redeploy** and **Deploy changes**. A locked page uses **Edit and deploy new revision**.
- The first **Create** has `BOT_TOKEN`, the Neon `-pooler` URL, and `WEBHOOK_SECRET`. `WEBHOOK_URL` is added in a second revision, after the `https://…run.app` address exists. Cloud Run does not inject that address. The code registers `<WEBHOOK_URL>/telegram` only when the variable is set.
- Local `.env` uses the direct Neon URL (no `-pooler`) and has no webhook variables. `TEST_DATABASE_URL` stays off Neon.
- Stop `npm run dev` before the revision that sets `WEBHOOK_URL` finishes. Telegram delivers to the webhook or to long polling, not both.

Create the Cloud Run service only after the webhook listener is on `origin/main`. A deploy of the long-polling process never opens port `8080`, and the revision fails.

The user commits and pushes unless they explicitly ask the agent to. Do not force-push `main`.

## Commit authorship

A commit has one author and one committer: the git config user. Do not pass `--author`. Do not set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, or `GIT_COMMITTER_EMAIL` to the agent.

Do not add a `Co-authored-by` trailer. That includes `Co-authored-by: Cursor <cursoragent@cursor.com>`.

`git commit` in this environment appends that Cursor trailer after the message. When the agent created the commit and it is not pushed, replace the commit so the trailer is gone and both author and committer stay the config user:

```bash
git add <files>
TREE=$(git write-tree)
PARENT=$(git rev-parse 'HEAD^')
NAME=$(git config --get user.name)
EMAIL=$(git config --get user.email)
NEW=$(GIT_AUTHOR_NAME="$NAME" GIT_AUTHOR_EMAIL="$EMAIL" GIT_COMMITTER_NAME="$NAME" GIT_COMMITTER_EMAIL="$EMAIL" git commit-tree "$TREE" -p "$PARENT" -m "<message>")
git reset --soft "$NEW"
```

Use `HEAD^` only when replacing the latest unpushed commit. Read `git log -1 --format=%B` afterward and confirm the trailer is absent.

## Commit messages

Follow the [RS School git convention](https://rs.school/docs/git-convention). That is Conventional Commits, with lowercase types.

```
<type>[optional scope]: <description>
```

- Write the description in the present tense and the imperative mood: `add webhook listener`, not `added webhook listener` or `adds webhook listener`.
- Keep the description a short summary of the change.
- Use one type, chosen for the main change. A scope is optional: `feat(bot): add telegram webhook listener`.

Types:

- `feat` — new behavior
- `fix` — a bug fix
- `refactor` — a restructure that does not change behavior
- `docs` — documentation only
- `style` — formatting only
- `test` — adding or fixing tests
- `perf` — performance
- `build` — build system or dependencies
- `ci` — CI configuration
- `chore` — anything else that does not change source or tests
- `revert` — reverting a previous commit

Do not use an `init` type. A body, a footer such as `Refs: #123`, or a breaking-change marker (`feat!:`) is optional.

Examples:

```
feat: add telegram webhook listener
fix: keep a player registered when the membership lookup fails
docs: update readme with webhook setup
```
