# Next tasks for Claude Code

The work left after the review follow-ups of November 2026 (PRs #74 to #99). Ticked tasks are
done; the rest is in priority order. Each task is
self-contained: give Claude Code one task at a time, in a fresh session.

## How to run a task

Paste this into Claude Code in VS Code, with the task number:

> Read `docs/agents/next-tasks.md` and do task N. Follow the rules at the top of that file.

## Rules for every task

- Start from an up-to-date `main`: `git checkout main && git pull`, then a new branch named in
  the task (`fix/...`, `feat/...`, `chore/...`).
- Follow `CLAUDE.md` (root, `server/`, `client/`): services hold the logic, every write uses
  Zod from `shared/schemas`, translations in both `en` and `fa`, design tokens only, seed
  updated with models.
- Add or update tests for the change. Run `npm run lint` and `npm test` before committing.
- One focused commit (or a few), then push and open a PR **into `main`**. Never stack a PR on
  another PR's branch: #75 and #76 were merged into their stacked bases and missed `main`.
- Wait for the **CI** check on the PR (`.github/workflows/ci.yml`) to be green. If it is red,
  read the failure and fix it on the same branch.
- Do not merge; the owner merges.
- Never commit secrets (`.env`, the Atlas URI, API keys).
- When the task is done, tick it in this file in the same PR (`- [x]`).

---

## Priority 1: dependency upgrades with known issues

### Task 1. zod 4 (fixes the last high advisory, GHSA-mrhx-c7xc-m3w5)
- [ ] Done

- **Branch:** `chore/zod-4`. Then close Dependabot PR #91 with a link to the new PR.
- **Why:** `npm audit` reports zod <4.6.6 as high. Today it is not reachable (no array or
  collection schemas, bodies capped at 100 kB), but it should be fixed.
- **Blocker found:** `@hookform/resolvers` 3.x does not support zod 4. Upgrade both together:
  `npm install zod@^4.6.7 -w shared -w server -w client` and
  `npm install @hookform/resolvers@^5 -w client`.
- **Known breaking changes to handle:**
  - `{ errorMap: () => ({ message: X }) }`, `required_error` and `invalid_type_error` are gone.
    Use `{ error: X }`, or `{ error: (issue) => (issue.input === undefined ? A : B) }`.
    Files: `shared/schemas/*.js` (auth, categories, products, stock, suppliers, users).
  - Keep the ESLint rule in `eslint.config.js` that forbids literal messages in
    `shared/schemas`: messages still come from `shared/errorCodes.js` (`m.*`). Update its
    selectors if the option names change (`error` instead of `message` / `required_error`).
  - `ZodError.errors` is gone (use `.issues`); check `server/src/middleware/validate.js` and
    the client form helpers.
  - `.default()` now returns the default without running it through the schema; check every
    `.default(...)` followed by `.transform(...)`.
  - `server/src/config/env.js` uses `z.preprocess` and `z.coerce`; re-run
    `server/tests/config/env.test.js`.
- **CI failure seen on #91:** `CategoriesPage.test.jsx:166` could not find "Enter a title":
  the custom required message was replaced by zod's default. Fixing the `errorMap` /
  `required_error` usages should fix this and similar tests.
- **Done when:** all suites and lint pass, every form still shows the same messages in English
  and Persian, and `npm audit` shows no zod advisory.

### Task 2. React 19 (react and react-dom together)
- [ ] Done

- **Branch:** `chore/react-19`. Close Dependabot PR #82 (it bumps only `react-dom`, which
  breaks: `Cannot read properties of null (reading 'useSyncExternalStore')`).
- **Steps:** `npm install react@^19 react-dom@^19 -w client`, and check the peer versions of
  `@testing-library/react`, Radix, `react-hook-form`, `@tanstack/react-query`, `cmdk`,
  `input-otp`, `react-hot-toast`. `forwardRef` still works in 19; do not rewrite components
  unless a test needs it.
- **Done when:** client tests and lint pass, and the app runs (`npm run dev`) with no React
  warnings in the console.

### Task 3. react-i18next 17
- [ ] Done

- **Branch:** `chore/react-i18next-17`. Do it **after Task 2** (it may need React 19). Close
  Dependabot PR #83 when done.
- **CI failure seen on #83:** `ProductsPage.fa.test.jsx:82` could not find the button
  "تعدیل موجودی Claw Hammer". Check how `Trans` / interpolated `aria-label`s render in the new
  version, and `client/src/components/BidiText.jsx` (`TBdi`).
- **Done when:** all client tests pass, Persian and English.

### Task 4. mongoose 9
- [ ] Done  
  **Status:** Done in Dependabot PR #85 (with a fix for the failed-login pipeline update); merge it when its CI is green.

- **Branch:** `chore/mongoose-9`, or merge Dependabot PR #85 if its CI is green (comment
  `@dependabot rebase` on it first if CI has not run).
- **Check:** pipeline updates now need `updatePipeline: true` when they go through Mongoose.
  `server/src/middleware/rateLimitStore.js` uses the driver collection directly, so it is not
  affected, but search for other `[{ $set: ... }]` updates. Check `strictQuery`, the
  `findOneAndUpdate` return option (`new: true`) and the transaction helpers in the stock
  service.
- **Done when:** server tests pass (including stock concurrency and `rateLimitStore.test.js`).

---

## Priority 2: reliability

### Task 5. Register the Telegram webhook once, not on every cold start
- [x] Done  
  **Status:** Done in PR #98: `npm run tg:webhook -w server`; cold starts only run getMe.

- **Branch:** `fix/telegram-webhook-once`
- **Today:** `server/src/serverless.js` calls `startBotSafely` (`server/src/bot/startSafely.js`)
  on each cold start, which calls `getMe` and `setWebhook` in the background.
- **Steps:** add `server/scripts/telegram-webhook.js` (`npm run tg:webhook -w server`) that
  calls `setWebhook` with `TELEGRAM_WEBHOOK_SECRET` for `APP_URL/api/telegram/webhook`. Add a
  manual GitHub workflow "Register Telegram webhook" (like `demo-reset.yml`, with a `confirm`
  input) that runs it with repository secrets. In serverless, only `bot.init()` in the
  background, or pass a static `botInfo` built from `TELEGRAM_BOT_USERNAME` and a new
  `TELEGRAM_BOT_ID` env var, so no Telegram call is made at cold start.
- **Docs:** README deploy section, `.env.example`, PRD section 9.
- **Done when:** tests cover the script (with a fake bot API) and the serverless start makes no
  `setWebhook` call.

### Task 6. One bootstrap for the local server and the serverless entry
- [ ] Done

- **Branch:** `refactor/bootstrap`
- **Steps:** extract `server/src/bootstrap.js` exporting `bootstrap(config)` that connects the
  database, creates the bot and messenger and returns `{ app, bot }`. Use it in
  `server/src/index.js` (then `listen`, local `startBot`, shutdown hooks) and in
  `server/src/serverless.js`. Keep today's behaviour: local start fails fast on a bad bot
  token; serverless never fails because of Telegram.
- **Tests:** `getApp()` failure and recovery (a failing database connection gives 503, and the
  next request retries), with `connectDatabase` mocked.

### Task 7. Fail fast without an email sender in production
- [x] Done  
  **Status:** No change needed: the production check already requires `EMAIL_FROM` for Brevo and SMTP.

- **Branch:** `fix/email-from-required`
- **Today:** `EMAIL_FROM` falls back to `Inventory <no-reply@localhost>` in
  `server/src/config/env.js` and `server/src/services/mail.service.js`, which providers reject.
- **Steps:** when `NODE_ENV=production` and `EMAIL_DELIVERY=send`, require `EMAIL_FROM` (the
  env schema already lists missing keys; check it covers the Brevo path too). Remove the
  `localhost` fallback for production. Test in `env.test.js`.

### Task 8. A small logger with request ids
- [ ] Done

- **Branch:** `feat/request-logging`
- **Steps:** a tiny logger (no new dependency needed) that prefixes lines with a request id
  (`crypto.randomUUID()` set in a first middleware, also sent as `X-Request-Id`). Use it in
  `middleware/error.js` (method, path, request id), `mail.service.js`, `startSafely.js` and
  `serverless.js` instead of bare `console`. Never log secrets, tokens, codes or passwords.
- **Tests:** the error handler logs the request id; the header is set.

---

## Priority 3: UI and accessibility

### Task 9. Skeleton loading rows and a lasting status message
- [x] Done  
  **Status:** Done in PR #99.

- **Branch:** `feat/table-skeletons`
- **Today:** `client/src/components/data-table/DataTable.jsx` shows one "Loading…" row; the
  `role="status"` element is inside a cell that appears and disappears.
- **Steps:** render 5 skeleton rows (table) or 3 skeleton cards (cards), using design tokens
  (`bg-muted`, `animate-pulse`, respecting `prefers-reduced-motion`). Keep one visually hidden
  `role="status"` element outside the table that always exists and says "Loading…" while
  loading. Update the DataTable tests that look for the loading text.

### Task 10. Empty states with an action
- [ ] Done  
  **Status:** Done in PR #99 for Products ("Show all products", "Add your first product"). Movements, Users and Suppliers can follow the same pattern.

- **Branch:** `feat/empty-state-actions`
- **Steps:** let `emptyMessage` in `DataTable` be a node. Products: "Clear filters" when
  filtered, "Add product" (admins) when the catalogue is empty. Movements and Users: "Clear
  filters" when filtered. Suppliers: "Add supplier" for admins. Translations in `en` and `fa`.
  Tests per page.

### Task 11. Persian link previews and static lang/dir
- [x] Done  
  **Status:** Done in PR #99.

- **Branch:** `feat/link-preview-fa`
- **Steps:** `client/index.html` has English-only Open Graph tags and `<html lang="en">`.
  Make the description bilingual (one line English, one Persian, since crawlers do not run
  JS), keep `client/src/test/linkPreview.test.js` passing. In `client/public/theme-init.js`,
  also set `lang` and `dir` from the saved language (`localStorage` key `language`, see
  `client/src/i18n/index.js`) before the first paint, so Persian users never see a left-to-right
  flash. Update `client/src/theme/theme.test.jsx` checks for that file.

### Task 12. One focus-ring utility and fewer arbitrary Tailwind values
- [ ] Done

- **Branch:** `refactor/tailwind-tokens`
- **Steps:** define a `focus-ring` utility in `client/src/index.css` (the repeated
  `focus-visible:ring-[3px] focus-visible:ring-ring` pair) and use it in `components/ui/*`.
  Replace `max-w-[90rem]`, `max-h-[300px]` and similar with theme values where an equivalent
  exists. Follow `docs/design-system.md`. No visual change intended; check light and dark.

---

## Priority 4: data and housekeeping

### Task 13. Remove the legacy "Initial stock" shim
- [ ] Done  
  **Status:** First half done in PR #98 (script and the Database maintenance workflow). After running `migrate-initial-reason` on Atlas, remove `LEGACY_INITIAL_NOTE`, `reasonAndNote()` and their tests.

- **Branch:** `chore/migrate-initial-stock-note`
- **Today:** `server/src/models/StockMovement.js` keeps `LEGACY_INITIAL_NOTE` and
  `reasonAndNote()` to map old movements whose note is "Initial stock" to `reason: 'initial'`.
- **Steps:** add `server/scripts/migrate-initial-reason.js` that sets `reason: 'initial'` and
  clears the note on those movements (idempotent, prints how many it changed), and a manual
  workflow to run it on Atlas (like `demo-reset.yml`). After it has run in production, remove
  the shim and its tests in a second PR. Movements are history: change only these fields.

### Task 14. Drop the old single-field product indexes in Atlas
- [x] Done  
  **Status:** Done in PR #98 (`sync-indexes` in the Database maintenance workflow). Run it once on Atlas.

- **Branch:** `chore/drop-old-product-indexes`
- **Why:** PR #96 replaced them with compound indexes, but Mongoose never drops indexes, so
  `category_1`, `supplier_1`, `title_1`, `quantity_1`, `price_1` and `isArchived_1` still cost
  writes in Atlas.
- **Steps:** a script `server/scripts/sync-indexes.js` that runs `Model.syncIndexes()` for each
  model and prints what it dropped and created, plus a manual workflow with a `confirm` input.
  Never drop the unique `sku_1` index (it is still defined, so `syncIndexes` keeps it).

### Task 15. Pin GitHub Actions to commit SHAs
- [x] Done  
  **Status:** Done in this PR. `db-maintenance.yml` (PR #98) still uses tags; pin it the same way after #98 merges.

- **Branch:** `chore/pin-actions`
- **Steps:** in `.github/workflows/*.yml` replace `actions/checkout@v7`, `actions/setup-node@v7`
  and `actions/cache@v4` with their full commit SHAs (comment the version next to each).
  Bump `actions/cache` to its current major. Dependabot (`.github/dependabot.yml`) keeps
  pinned SHAs updated.

### Task 16. Bring client/CLAUDE.md up to date
- [x] Done  
  **Status:** Done in PR #99.

- **Branch:** `docs/client-claude-md`
- **Steps:** the structure list says hooks live in `hooks/`, but data hooks live in `lib/`
  (`lib/products.js`, `lib/users.js`, …). Describe `lib/`, `hooks/useMediaQuery.js`
  (`useIsMobile` below 768 px for sheets, `useIsCompact` below 1024 px for cards),
  `components/PageMeta.jsx`, and `test/mobile.js` (`mockMobile`, `mockTablet`).

---

## Priority 5: reviews not finished

### Task 17. Security review of account linking and one-time codes
- [ ] Done

- **No code branch unless a problem is found.**
- **Steps:** run the `security-reviewer` agent (`.claude/agents/security-reviewer.md`) on
  `server/src/services/accountLink.service.js`, `telegramAuth.service.js`,
  `profile.service.js`, `auth.service.js`, `otp`/token services and `bot/bot.js`. Check
  account takeover through linking (Telegram to email and back), constant-time comparison of
  codes and tokens, enumeration through responses or timing, and rate limits on every step.
  Write the findings to `REVIEW-auth.md`; fix confirmed problems in separate PRs.

### Task 18. Finish the architecture and UI reviews
- [ ] Done

- **Steps:** the earlier runs could not use Grep/Glob (`EUNKNOWN uv_spawn` on Windows; update
  the Claude Code extension and restart VS Code first). Run `architecture-reviewer` on the
  services and controllers it did not read (auth, stock, dashboard, users, suppliers,
  categories), and `ui-reviewer` on Login, Register, Profile, Users, Movements, Categories,
  Suppliers, the forms and the dashboard, with screenshots at 375, 768 and 1280 px in light and
  dark. Write `REVIEW.md` again and turn confirmed findings into tasks in this file.

---

## Owner tasks (not for Claude Code)

- [ ] Create a real admin account with a private email: `$env:MONGODB_URI="<Atlas URI>"` then
      `npm run user:create -w server -- you@example.com "<long password>" "Your Name"` (the demo
      account `admin@example.com` is limited by `DEMO_EMAILS` and cannot approve users).
- [ ] Optional: real email through Brevo (`BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_DELIVERY=send`
      in Vercel, then redeploy).
- [ ] Every week: open the Dependabot PRs; merge the green minor and patch ones.
