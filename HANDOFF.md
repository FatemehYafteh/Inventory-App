# Handoff: M3 Telegram identity (2026-10-14)

## Where things stand

- **Branch:** `feat/telegram-identity`, pushed and tracking `origin/feat/telegram-identity`. Working tree clean.
- **PR:** [#8](https://github.com/FatemehYafteh/Inventory-App/pull/8) "M3: Telegram sign-in and identity linking", into `sub-prds`.
  - It also carries the M1 and M2 commits, which are not on `sub-prds` yet. M3 starts at `a504e1d` (#1), so review `a504e1d^..HEAD` for M3 only.
  - The body says "Closes #1 … #7", so all seven M3 issues close on merge.
- **Ultrareview of PR #8:** launched, results not in yet. Next step: when the findings arrive, check each one against the code, fix the real ones with tests, run both suites, and push to the branch.
- **Tests at the last commit (`d26b64e`):** server 174 passed (19 files), client 87 passed (12 files), lint clean.

## M3 issues (one commit each)

| Issue | Commit | What |
|---|---|---|
| #1 | `a504e1d` | Telegram sign-in, happy path in development (`tg:start` stands in for the bot) |
| #2 | `ba8b2e5` | One-time code policy: 2 min, 3 tries, resend after 60 s, 5 sends per hour per Telegram ID, rejected users refused; countdowns and QR on the page |
| #3 | `6c59556` | Real bot (grammY): polling in development, verified webhook in production, fail fast on missing env |
| #4 | `bedfa83` | Complete profile, case 1: verify link, `pendingEmail`, 5 emails per hour per address, `requireProfile` gate |
| #5 | `ade195f` | Account link (case 2, Confirm link with password, one transaction), case 3 notice, rejected owners get nothing |
| #6 | `bb64361` | Profile page: name, sign-in methods, password reset email; minimal layout for pending users |
| #7 | `d26b64e` | Connect Telegram: ownership checked after the code, Placeholder user absorbed, anyone else gets 409 |

## Open items (from the per-issue reviews, not fixed)

- **`requireProfile` is not on any data route yet.** Sub-PRD 04 (task 4.1) must put it after `authenticate` on every route outside the allow-list (`/me`, `/profile/complete`, `/profile/resend-verification`, `/refresh`, `/logout`).
- **Send limit race:** two Starts for one Telegram ID at the same moment, at 4 sends, can both go out (6 total). Only the account's owner can press Start, so the risk is low.
- **Send limit window:** sends are counted by the request's `createdAt`, as the spec says, so a request's sends can leave the hour after 50 minutes.
- **Refused connect uses up the code:** a refused or failed connect needs a new Start, which counts toward the 5 per hour.
- **Resend buttons after a reload** (Complete profile, Profile reset email): the page can say "sent" while the server skipped the send inside its 60 s cooldown.
- **Webhook registration:** a failure is logged and not retried.
- **No seed data** for a Placeholder user waiting on an existing account's email (an Account link in progress). Add it if the UI needs it.
- **Duplicated step:** absorbing a Placeholder user is written out in both `accountLink.service.js` and `telegramAuth.service.js` `verifyConnect`. A shared helper would remove it.
- **Webhook CSRF exception:** recorded only in code comments and `server/src/bot/README.md`, not in `CLAUDE.md` or an ADR.

## Running it

- `npm run db:dev -w server`, `npm run seed -w server`, `npm run dev` (API on :4000, client on :5173).
- Without `TELEGRAM_BOT_TOKEN`, the server logs start tokens and codes. Press Start with `npm run tg:start -w server -- <startToken> <telegramId> "<name>" [username]`.
- Production needs `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (1–256 of `A-Za-z0-9_-`) and `BOT_MODE=webhook`. Startup fails if the token belongs to another bot than `TELEGRAM_BOT_USERNAME`.

## Environment notes

- The GitHub CLI is at `C:\Program Files\GitHub CLI` and is signed in as FatemehYafteh. Its folder was added to the user PATH on 2026-10-14; Claude Code needs a restart to see it (until then, `/web-setup` reports "GitHub CLI not found").
- Next milestone: M4, roles and approval (sub-PRD 04), tracked in `tasks/task.md`.
