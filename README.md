# Product Inventory Manager

One repository for the whole app.

```
client/   React (Vite) web app
server/   Node.js + Express + MongoDB API and Telegram bot
shared/   Zod schemas used by both (added in milestone 1)
docs/     PRD and sub-PRDs (start at docs/prds/README.md)
```

> **Email is not set up yet.** The deployed app runs with `EMAIL_DELIVERY=log`, which sends nothing.
> Until an email provider is configured (`BREVO_API_KEY` with `EMAIL_FROM`, or `SMTP_*`) and
> `EMAIL_DELIVERY` is set to `send`:
>
> - a new email sign-up cannot verify its address, so it cannot log in;
> - "Forgot password" emails never arrive, so a forgotten password cannot be reset by the user;
> - the verification and account-link emails of Telegram sign-ups never arrive.
>
> Signing in with Telegram, and the seeded accounts, work. In production the server also **never
> writes an email's link to the log**, on purpose: the link would let anyone who can read the logs
> take over that account. In development the full email (link included) is still logged.
> Set the provider before real users sign up. See "Vercel environment variables" below.

## Run locally
Requires Node 22 (the version CI and Vercel use; see `engines` in `package.json`).

```sh
npm install
cp server/.env.example server/.env   # then fill in the two JWT secrets
npm run dev                          # MongoDB replica set on :27018, API on :4000, web app on http://127.0.0.1:5173
npm run seed -w server               # demo data for every model (see below), in a second terminal while dev runs
```

The database runs on :27018 because 27017 is often taken by an installed MongoDB service. To browse it in Compass, connect to `mongodb://127.0.0.1:27018/?directConnection=true` while `npm run dev` is running. If you already run the database yourself (`npm run db:dev -w server`), `npm run dev:app` starts only the API and web app.

### Seed data
`npm run seed -w server` adds demo users, categories, suppliers, products and their stock history, and keeps anything already there. `npm run seed:reset -w server` wipes those collections and seeds again. Both refuse to run in production.

> **Warning:** `npm run seed:reset -w server` deletes **every user, session and sign-in too**, not only the demo data, so real accounts are gone afterwards. To refresh only the demo catalog, use `npm run seed:demo-reset -w server` below.

`npm run seed:demo-reset -w server` (it needs `DEMO_MODE=true`, for example in `server/.env`; otherwise it refuses before touching the database) deletes and reseeds only products, stock movements, categories and suppliers. It keeps every user, refresh-token session, email token and status change, and creates no user. The stock history is attributed to existing active users with a verified email and a name (admins first, up to three); if there is none it stops before deleting anything. It refuses to run in production.

Locally, seeded accounts share the password `inventory-demo-2026` (override with `SEED_PASSWORD`). Any database that is not on your machine, such as Atlas, needs its own `SEED_PASSWORD` of at least 12 characters; the seed refuses the default password there:

| Email | Role | Status | Notes |
|---|---|---|---|
| admin@example.com | admin | active | |
| staff@example.com | staff | active | |
| linked@example.com | staff | active | Telegram connected |
| pending@example.com | staff | pending | sees Awaiting approval |
| rejected@example.com | staff | rejected | login refused |
| unverified@example.com | staff | pending | email not verified, login refused |
| telegram-nopass@example.com | staff | active | Telegram signup with no password: set one through "Forgot password?" |

`npm run user:create -w server -- you@example.com "a-long-password" "Your Name"` adds an extra active admin. Accounts made through the Register page stay `pending` until admin approval exists (milestone 4). Without SMTP settings, verification and password reset emails and their links are printed in the server log. Setting up Brevo and the checks before launch are in [docs/launch-checklist.md](docs/launch-checklist.md).

```sh
npm test        # server (in-memory replica set) and client tests
npm run lint
npm run test:e2e   # a real browser: sign in, add a product, receive and ship stock, sign out
```

`npm run test:e2e` builds the client and runs it, with the real API and an in-memory MongoDB, in
Chromium (see `e2e/`). Install the browser once with `npx playwright install chromium`. It needs
ports 4000 and 5173 free (stop `npm run dev` first) and refuses to reuse a server already running
there, so it can never touch your own development database. After a failed run, open the report with
`npx playwright show-report e2e/playwright-report`.

## Deployment
Free tier only, no credit card: the web app **and** the API on **Vercel**, the database on **MongoDB Atlas** (`M0`, already a replica set). Email is off for now (`EMAIL_DELIVERY=log`): in production the server logs only that an email was held back (recipient and subject), **never its body**, because the body holds one-time reset and verification links that would let anyone with log access take over an account. So with no provider, email sign-up verification and password reset cannot complete: use the seeded accounts (or Telegram sign-in) for a demo, and set `BREVO_API_KEY` (or SMTP) with `EMAIL_DELIVERY=send` before real users sign up. In development the full email, links included, is still logged.

```
browser  ──> Vercel ── static files (client/dist)
Telegram ──>        └─ /api/* ──> api/index.js (Express app as a Vercel Function) ──> Atlas
```

Everything is served from one address, so the `SameSite=Strict` cookies and the CSRF Origin check work unchanged and no CORS is needed.

- `vercel.json` builds `client/`, sends every `/api/*` request to `api/index.js`, and serves `index.html` for client routes. Functions run in Frankfurt (`fra1`), next to the Atlas cluster.
- `api/index.js` runs the same Express app as `npm run dev`, built once per instance by `server/src/serverless.js`. In webhook mode it registers the Telegram webhook on each cold start, in the background: if Telegram is unreachable or the bot token does not match `TELEGRAM_BOT_USERNAME`, the error is logged and the rest of the API keeps working. `BOT_MODE` must be `webhook` on Vercel. The database connection gives up after 5 s (`MONGO_SERVER_SELECTION_TIMEOUT_MS`) with a 503, and each instance keeps at most 10 connections (`MONGO_MAX_POOL_SIZE`). Rate-limit counters are kept in MongoDB in production (`RATE_LIMIT_STORE`, collection `ratelimithits`, cleaned up by a TTL index), so every instance shares them.
- Vercel environment variables (Settings > Environment Variables), the same names as `server/.env.example`:
  `NODE_ENV=production`, `BOT_MODE=webhook`, `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `EMAIL_DELIVERY=log`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (`npm run secret:generate -w server`), `CLIENT_ORIGIN` and `APP_URL` (the Vercel address), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_EMAILS`. Optional: `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` show a demo account box on the login page. Put the same email in `DEMO_EMAILS`, so visitors using the demo account cannot reject or demote real users (the server refuses it, and the Users page shows those actions disabled). The demo account also sees other users' emails and Telegram usernames masked, and its search matches names only. Redeploy after changing any of them.
- Demo data: in GitHub, Actions > **Seed demo data** > Run workflow, and type `SEED` in the confirm field (needs the repository secrets `MONGODB_URI` and `SEED_PASSWORD`). It runs `server/scripts/seed.js` on GitHub's servers and only adds what is missing. Running it from your own machine also works (`npm run seed -w server` with `MONGODB_URI` pointing at Atlas) where DNS answers SRV lookups. `npm run seed:reset -w server` wipes every seeded collection, **users included**: do not point it at a database with real accounts.
- Reset demo data: Actions > **Reset demo data** > Run workflow, and type `RESET` in the confirm field (same `MONGODB_URI` secret). It also needs the repository **variable** `DEMO_MODE` set to `true` (Settings > Secrets and variables > Actions > Variables): a deliberate switch to set only while the database holds demo data. Without it the workflow stops at its first step, and the script refuses on its own too. Delete the variable once real data is in the database. It runs `npm run seed:demo-reset` logic (`server/scripts/seed-demo-reset.js`) on GitHub's servers: products, movements, categories and suppliers are deleted and reseeded, and **all users and their sessions are kept**.
- Health checks: `GET /api/health` says the process is up and never touches the database. `GET /api/health/ready` also pings MongoDB (3 s limit) and answers `503` when it is down, so point an uptime monitor or load balancer at `/api/health/ready` to catch a database outage. Both are public and cheap; the ready check is limited to 120 a minute per IP.
- If the database is unreachable the API answers `503 SERVICE_UNAVAILABLE` (with `Retry-After`) and recovers by itself when it returns, with no restart.

## Known limitations
What a careful reviewer would still point out, in plain words, and what would fix it. None of them
stops the app from working today.

1. **Nothing protects the production data yet.**
   - The "Reset demo data" workflow deletes every product, stock movement, category and supplier.
     It now refuses unless the repository variable `DEMO_MODE` is `true`, but if real stock and
     demo data share one database, a reset run on purpose still erases the real stock.
   - There is no written backup or restore plan (the free Atlas tier may not include automated
     backups: check), and nothing watches the app or reports its errors.
   - Email is off (see the note at the top), so password reset and email sign-up cannot finish.
   - **What would fix it:** keep demo data and real data in separate databases (or remove
     `DEMO_MODE` once real data arrives); turn on backups (a paid Atlas tier, or a scheduled
     export) and try one restore; point an uptime checker at `/api/health/ready` and add error
     tracking; set up an email provider.
2. **The tests prove less than their number suggests.**
   - About 1,500 tests check the screens and the server separately. The screen tests answer
     from pretend (mocked) server replies, so they cannot notice if the real server changes.
   - A small browser test now covers one main flow (sign in, add a product, receive and ship
     stock, sign out) against the real server, and CI runs the production build.
   - **What would fix it:** grow the browser tests to the other flows (register and approval,
     editing and archiving, Persian and right-to-left, the phone layout), and check that the
     mocked replies match what the real API sends.
3. **Some reads get slower as the data grows.**
   - With 100,000 products, search and the stock-status filters take about 0.2 to 0.5 seconds and
     the dashboard about 0.3 seconds, because they read every product. Stock movements only ever
     grow. The supplier list on the product form shows only the first 100 suppliers.
   - That is fine for a small business. It was measured with one user, never with many at once.
   - **What would fix it:** faster search (a text index or a stored search field), a stored and
     indexed stock status, cached dashboard totals, a supplier picker you can search, archiving
     old movements, and a test with many users at the same time.

## Git workflow
- `main` is always working. Do not commit to it directly.
- Branch per sub-PRD or task: `feat/<area>-<short-name>`, `fix/...`, `docs/...`, `chore/...`.
- One commit per logical change; open a PR into `main`.
- Never commit `.env` files. Commit `.env.example` instead.
