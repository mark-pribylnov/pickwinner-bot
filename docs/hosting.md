# Hosting Pickwinner

This is the setup that is running: Neon holds the scores, Google Cloud Run runs the bot, and Telegram sends each command to Cloud Run over a webhook. Cloud Run stays at zero instances while nobody is playing, then starts for a request. A normal month stays inside the free quotas. Google and Neon still ask for a card.

Read one screen at a time. The headings below match the pages in the consoles. Do the steps on that page, then go to the next heading.

Two addresses exist for the same Neon database. They are not interchangeable.

| Where the bot runs | Neon connection | Host name | Webhook variables |
| --- | --- | --- | --- |
| Your machine, `npm run dev` | Direct. In the Neon Connect dialog, connection pooling is off. | No `-pooler` | Leave `WEBHOOK_SECRET` and `WEBHOOK_URL` unset. The bot long-polls. |
| Cloud Run | Pooled. In the Neon Connect dialog, connection pooling is on. | Contains `-pooler` | `WEBHOOK_SECRET` and `WEBHOOK_URL` are set on the service. The bot listens for HTTPS. |

Both strings use `sslmode=verify-full`. The Cloud Run string is the one whose host contains `-pooler`.

The program decides the mode from the environment, in `src/config.ts`:

- `WEBHOOK_SECRET` empty and `WEBHOOK_URL` empty: long polling.
- `WEBHOOK_SECRET` set: listen on `PORT` (Cloud Run sets this to `8080`). `GET /` responds with the text `ok`. Telegram must `POST` to `/telegram` and send the secret.
- `WEBHOOK_URL` set as well: on startup the bot tells Telegram to deliver updates to `<that address>/telegram`. Any path you paste is replaced with `/telegram`. The value must be `https`.

Cloud Run does not put its public `https://…run.app` address into the container. The address on the service page is for humans. The bot only sees `BOT_TOKEN`, `DATABASE_URL`, `WEBHOOK_SECRET`, `WEBHOOK_URL`, and `PORT`. That is why `WEBHOOK_URL` is typed in by hand after the first deploy.

`WEBHOOK_SECRET` is 1–256 characters and may contain only letters, digits, `_`, and `-`. `openssl rand -hex 32` produces a valid one.

A push to `main` on `mark-pribylnov/pickwinner-bot` builds a new Cloud Run revision from that commit. The build uses Google Cloud Buildpacks (`gcp-build` runs `tsc`). The repository has no `Dockerfile`.

## BotFather: group privacy

Pickwinner must not receive ordinary group messages. Sublime does, which is why a command addressed to Pickwinner can still make Sublime reply.

In BotFather:

1. Open [@BotFather](https://t.me/BotFather).
2. Send `/setprivacy`.
3. Choose this bot.
4. Choose **Enable**.

**Enable** is privacy mode on. In the group member list the bot then shows **нет доступа к сообщениям**.

Leave it that way. **Disable** changes the line to **имеет доступ к сообщениям** and Telegram sends the bot every message in the group, including commands meant for another bot.

With **Enable**, the bot still receives its own commands (`/pwreg`, `/pw`, and the rest), replies to its own messages, `@` mentions of the bot, and join/leave service messages. It does not need to be a group admin. An admin receives every message even when privacy is enabled, so do not promote the bot for that reason.

## Neon: create the database

1. Open [console.neon.tech](https://console.neon.tech) and sign in.
2. Create a project. The running project is in Europe. Cloud Run for this bot is `europe-west1` (Belgium), which is close enough.
3. Click **Connect**.
4. Leave branch, database, and role on their defaults. The database name is usually `neondb`.

Copy two strings before leaving this dialog. You will not see this dialog again unless you click **Connect**.

5. Turn **Connection pooling** off. Copy the string. The host must not contain `-pooler`. This is the local `DATABASE_URL`.
6. Turn **Connection pooling** on. Copy the string. The host must contain `-pooler`. This is the Cloud Run `DATABASE_URL`.
7. In both strings, change `sslmode=require` to `sslmode=verify-full`. Leave the rest of each string as Neon printed it, including `channel_binding=require` when it is present.

`pg` prints a security warning for `sslmode=require` and already treats it as `verify-full`. Setting `verify-full` keeps that behavior and removes the warning.

If a later connection error mentions `channel_binding`, delete `&channel_binding=require` from the string you are using and try again.

## Neon: local `.env`

In the project folder:

```bash
cp .env.example .env
```

`.env` is gitignored. Put the direct Neon string (no `-pooler`) in `DATABASE_URL`. Put the BotFather token in `BOT_TOKEN`. Do not add `WEBHOOK_SECRET` or `WEBHOOK_URL` on your machine. Do not point `TEST_DATABASE_URL` at Neon. Tests that see `TEST_DATABASE_URL` use it instead of the local database, and they must keep using a database whose name ends in `pickwinner_test`.

Check Neon from the project folder:

```bash
node --env-file=.env --import tsx -e '
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const r = await pool.query("select current_database() as db");
  console.log("connected:", r.rows[0].db);
} catch (e) {
  console.error(e);
} finally {
  await pool.end();
}
'
```

`connected: neondb` means the direct string works. The first `npm run dev` creates the `players` and `picks` tables. In the Neon console those names show under **Tables**.

On the free plan the database sleeps after a few quiet minutes. The next query wakes it in about half a second. A connection that stayed open across that sleep can fail once. The command after that works.

## Google Cloud: project and billing

1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. In the top bar, open the project dropdown and create a project named `pickwinner`. Wait until it exists, then select `pickwinner` in that same dropdown. A service created while another project is selected lands in the other project.
3. Search for **Billing** and link a billing account. The card is what allows the service to wake. Usage for this bot stays in the free quota.
4. In **Billing**, open **Budgets & alerts**, create a budget for `$1`, and turn on the email alerts.
5. Search for **Cloud Run** and open it. If it asks to enable an API, click **Enable**.

## Cloud Run: you want the GitHub form, not an image URL

**Container image URL** appears when the form is **Deploy one revision from an existing container image**. This project has no image yet. Leave that field empty.

Go back and choose **Connect repo**, or **Continuously deploy new revisions from a source repository**.

On the next choice, pick **Cloud Build**.

## Cloud Run: connect GitHub

1. Repository provider: **GitHub**. Click **Authenticate**.
2. GitHub opens. Sign in as the owner of `mark-pribylnov/pickwinner-bot`. Install **Google Cloud Build** when asked. Under repository access, choose **Only select repositories** and select `pickwinner-bot`. Confirm with **Install** or **Save**.
3. Back in Google Cloud, select `mark-pribylnov/pickwinner-bot`. If the list is empty, use **Manage connected repositories**, grant that repo, and return. Click **Next**.

The build step looks like this. These values are already correct when the context directory is `/` and the other two boxes are empty:

1. **Branch:** `^main$`. If the box only accepts a branch name, type `main`. The page should show that `main` matches.
2. **Build type:** the selected radio is **Go, Node.js, Python, Java, .NET Core, Ruby or PHP via Google Cloud's buildpacks**. There is no separate "Node.js" radio. Buildpacks read `package.json` and build this repo as Node.js. The **Dockerfile** option fails because this repo has no `Dockerfile`.
3. **Build context directory:** `/`
4. **Entrypoint:** empty. Google then runs `npm start`, which is `node dist/index.js`.
5. **Function target:** empty. This is a server, not a function.
6. Click **Save**.

You return to the Create service form.

## Cloud Run: create the service

Fill the form from top to bottom.

- **Service name:** `pickwinner`
- **Region:** `europe-west1` (Belgium)
- **Authentication:** **Allow public access**, also labeled **Allow unauthenticated invocations**. Telegram calls the address with no Google login.
- **Billing:** **Request-based**. Idle time at zero instances costs nothing.
- **Service scaling:** autoscaling stays on. **Minimum number of instances:** `0`. **Maximum number of instances:** `2`.
- **Ingress:** **All**

Open **Containers, Networking, Security**. On the **Container** tab:

- **Container port:** `8080`
- **Memory:** `512 MiB`
- **CPU:** `1`
- **Request timeout:** `60` seconds. The default `300` is also fine.
- **Startup CPU boost:** on, when the checkbox is there.
- Health checks, execution environment, and concurrency stay on their defaults.

On **Variables & Secrets**, add these three. Type the values in the form. They do not go in git or in chat.

| Name | Value |
| --- | --- |
| `BOT_TOKEN` | the BotFather token |
| `DATABASE_URL` | the Neon string with `-pooler` and `sslmode=verify-full` |
| `WEBHOOK_SECRET` | the output of `openssl rand -hex 32` |

Leave `WEBHOOK_URL` off this first deploy. The `https://…run.app` address does not exist until this deploy finishes.

**Volumes** and **Networking** stay on their defaults.

On the **Security** tab the page will not create the service while **Service account** is empty. The field shows **Service account is required.**

1. Open the **Service account** dropdown.
2. Choose **Default compute service account**. The email ends in `-compute@developer.gserviceaccount.com`.
3. Leave **Verify container deployment with Binary Authorization** unchecked.
4. Leave **Google-managed encryption key** selected.

Click **Create**. The first deploy is done when three checks are green and the service shows an `https://…run.app` address.

Open that address in a browser. The page body is the word `ok`. That tab is the bot. It has no settings and no **Edit** button.

## Cloud Run: tell Telegram the address

Go back to the Google Cloud tab. Open [Cloud Run](https://console.cloud.google.com/run) and click the `pickwinner` service. You are editing the console, not the page that says `ok`.

1. Open the **Containers** tab.
2. Under **Variables & Secrets**, click **Add variable**.
3. Name: `WEBHOOK_URL`. Value: the `https://…run.app` address with nothing after `.run.app`.
4. Click **View diff & redeploy**, then **Deploy changes**.

When the service page is locked, the top button is **Edit and deploy new revision**. Use it, then follow the same variable steps and deploy.

Stop `npm run dev` before this revision finishes. Telegram delivers updates to one place. After this revision, that place is Cloud Run. Starting `npm run dev` later deletes the webhook again (see **Keep it working**).

The new revision calls Telegram `setWebhook`. The registered path is `<WEBHOOK_URL>/telegram`. The secret header is required. A request with the wrong secret gets `401`.

Send `/pwreg` in the group. The bot answers `Вы в игре.` (or `Эй, ты уже в игре!` if you are registered). The first command after a quiet stretch can take about a second, because Cloud Run and Neon both wake up.

## Keep it working

Leave these Cloud Run settings as they are:

- Minimum instances `0`, billing **Request-based**. Minimum `1` keeps a container up all night and starts a bill.
- All four variables: `BOT_TOKEN`, `DATABASE_URL` (the `-pooler` string), `WEBHOOK_SECRET`, `WEBHOOK_URL`.
- Public access and ingress **All**.

A push to `main` builds a new revision and keeps those variables. If a push breaks the bot, open the service, go to **Revisions**, and send traffic back to the previous green revision.

The `$1` budget email means something is being billed. Open Billing and check that minimum instances is still `0`.

The token and both Neon strings live in local `.env` and in the Cloud Run variables. If the token leaks, revoke it in BotFather and replace `BOT_TOKEN` in both places.

Deleting the Cloud Run service produces a new `https://…run.app` address. Set `WEBHOOK_URL` to the new address and deploy again.

`npm run dev` long-polls, and starting it deletes the Telegram webhook. It also runs with `MAINTENANCE=1`, so while it runs every command gets the maintenance line, and the hosted bot receives nothing. Stopping it does not bring the webhook back. The hosted bot receives commands again only when a Cloud Run revision registers the webhook: a new revision starts, with `WEBHOOK_URL` set, and calls `setWebhook`. After local work, push to `main` or deploy a new revision from the **Revisions** page, then send `/pwreg` in the group and check for the reply.

Telegram will not deliver to the webhook and to a poll at the same time. Use the Cloud Run bot for the group. Run the local process only when you mean to work on the code.

One draw per group per Moscow day (UTC+3). The day rolls at midnight Moscow, and `/pwrules` says so. The first `/pw` of the day runs the draw. A later `/pw` the same day repeats the winner. A person who leaves and comes back keeps their score and sends `/pwreg` again.

If a command gets no reply, send it once more. Then open **Logs** on the Cloud Run service. The process logs the error and does not send it to the chat. `database connection failed` on startup means the revision could not reach Neon. `WEBHOOK_URL is not set` in the logs means the service is awake and Telegram has not been given the address yet.

Neon can suspend a free project that sits unused for a long time. If the logs say the database connection failed and the string has not changed, open the Neon project and wake it.
