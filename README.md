# Product Inventory Manager

One repository for the whole app.

```
client/   React (Vite) web app
server/   Node.js + Express + MongoDB API and Telegram bot
shared/   Zod schemas used by both (added in milestone 1)
docs/     PRD and sub-PRDs (start at docs/prds/README.md)
```

## Run locally
Requires Node 20.6+.

```sh
npm install
cp server/.env.example server/.env   # then fill in the two JWT secrets
npm run dev                          # MongoDB replica set on :27018, API on :4000, web app on http://127.0.0.1:5173
npm run seed -w server               # demo data for every model (see below), in a second terminal while dev runs
```

The database runs on :27018 because 27017 is often taken by an installed MongoDB service. To browse it in Compass, connect to `mongodb://127.0.0.1:27018/?directConnection=true` while `npm run dev` is running. If you already run the database yourself (`npm run db:dev -w server`), `npm run dev:app` starts only the API and web app.

### Seed data
`npm run seed -w server` adds demo users, categories, suppliers, products and their stock history, and keeps anything already there. `npm run seed:reset -w server` wipes those collections and seeds again. Both refuse to run in production.

Seeded accounts share the password `inventory-demo-2026` (override with `SEED_PASSWORD`):

| Email | Role | Status | Notes |
|---|---|---|---|
| admin@example.com | admin | active | |
| staff@example.com | staff | active | |
| linked@example.com | staff | active | Telegram connected |
| pending@example.com | staff | pending | sees Awaiting approval |
| rejected@example.com | staff | rejected | login refused |
| unverified@example.com | staff | pending | email not verified, login refused |
| telegram-nopass@example.com | staff | active | Telegram signup with no password: set one through "Forgot password?" |

`npm run user:create -w server -- you@example.com "a-long-password" "Your Name"` adds an extra active admin. Accounts made through the Register page stay `pending` until admin approval exists (milestone 4). Without SMTP settings, verification and password reset emails and their links are printed in the server log.

```sh
npm test        # server (in-memory replica set) and client tests
npm run lint
```

## Git workflow
- `main` is always working. Do not commit to it directly.
- Branch per sub-PRD or task: `feat/<area>-<short-name>`, `fix/...`, `docs/...`, `chore/...`.
- One commit per logical change; open a PR into `main`.
- Never commit `.env` files. Commit `.env.example` instead.
