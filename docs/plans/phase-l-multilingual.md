# Phase L implementation plan: multilingual support (English and Persian)

Inputs: `tasks/task.md` (Phase L, L0 to L5), `shared/schemas`, `server/src/services/mail.service.js`, `mail.templates.js`, `server/src/bot/bot.js`, `userNotify.service.js`, `client/src/components/ui/calendar.jsx`, `client/src/lib/format.js`, `GLOSSARY.md`.
Interview held on 2026-10-21 (questions Q1 to Q15, in three rounds). Q9 was deferred to L3 by the owner.

**Status (2026-10-21): approved and implemented as issues #34 to #38 (L1 to L5), one commit each on stacked local branches. Persian texts are drafts for the owner to proofread.**

This plan has four separate parts: **1 Decisions** (settled with the owner), **2 Assumptions** (taken as true; what breaks if wrong), **3 Changes** (scope, behavior, data, tickets), **4 Unknowns** (open, with who resolves them).

---

## 1. Decisions

| # | Decision |
|---|---|
| Q1 | Server and shared text is translated by **stable codes**. Server responses and Zod messages carry a code; the client maps codes to `en` and `fa` text. Responses keep an English `message` as a fallback and for logs. The existing response contract and `ApiError` stay valid: codes are only **added** (see 3.7). |
| Q2 | The language preference is a `language` field (`en` or `fa`, default `en`) on the User record, plus browser storage for logged-out pages. Changing it needs the seed data and `server/tests/seed/seed.test.js` updated. |
| Q3 | Translated server-sent text: verification, password-reset and "password changed" emails; approve and reject notifications by email and by the Telegram bot; `/start` and other bot replies. All follow the recipient's saved language, with English as the fallback. |
| Q4 | Persian font is **Vazirmatn**, self-hosted in the client bundle, used for Persian only. English keeps the current `--font-sans`. |
| Q5 | The language switcher is in the **header on every page** (including logged-out pages) and also on the **Profile** page. |
| Q6 | Persian shows **Persian digits and the Jalali calendar**. English keeps Latin digits and the Gregorian calendar. |
| Q7 | Client tests run in a fixed language (`en`). Each new piece adds targeted `fa` and RTL tests. Server tests keep asserting codes. |
| Q8 | Jalali is **display and date pickers only**. Storage, API, CSV export and the server stay ISO (UTC) and Latin digits. Filters send ISO dates. |
| Q9 | The Jalali library is chosen **in L3**, not before. Two things are decided separately there: (1) **formatting text** (dates, digits, month names), which browser `Intl` with `fa-IR-u-ca-persian` can do; and (2) the **date-picker grid**, which depends on the installed `@daypicker/react` (10.0.2, used by `calendar.jsx`) and not on `Intl`. Today that package only re-exports a `fa-IR` locale and its exports list no Jalali calendar entry, so a Jalali grid is **not confirmed**; `date-fns` 4.4 is installed but is Gregorian. L3 starts by checking this and then picks one of: picker support, `date-fns-jalali`, or a Jalali-aware wrapper. |
| Q10 | The Telegram bot uses the language of the linked user. Before an account is linked it uses Telegram's `language_code` (`fa` gives Persian) and falls back to English. |
| Q11 | One **shared error-code catalogue** in `shared/` lists every code (validation and `AppError`) with an English default. The client holds `en` and `fa` translations keyed by those codes. A test fails if a code lacks a translation. |
| Q12 | Client library is **react-i18next**. |
| Q13 | The owner's assistant drafts all Persian text, in one JSON file per area. The owner proofreads before each PR merges. A test makes sure every key exists in both languages. |
| Q14 | Number and search inputs accept Persian (۱۲۳) and Arabic-Indic (١٢٣) digits and normalise them to Latin digits before validation, so the API only ever sees Latin digits. |
| Q15 | One branch and one PR per phase (L1 to L5), `feat/<area>-<short-name>`, into `sub-prds`. Each phase is **one GitHub issue and one commit** (`feat: <issue title> (#<issue>)`), so a phase PR contains one commit. See 3.6. |

---

## 2. Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | User-entered data (product titles, notes, category and supplier names) is never translated. | Out of scope; would need a content-translation design. |
| A2 | Existing users default to `en` through the schema default, so no data migration is needed. | Add a one-off migration script. |
| A3 | Phase L is built before M8, so the Movements page, Dashboard and CSV export get translation keys and Jalali date filters from the start. | M8 would need a later string-migration pass. |
| A4 | The `x-test-user` test hook is unaffected; tests that need a language set `language` on the test user. | Adjust the hook, test-only. |
| A5 | Browsers used by the team support `Intl` with the Persian calendar and `fa-IR` digits (all current browsers do), and the Node used for tests has full ICU. This covers **formatting only**, not the date-picker grid (see Q9). | Fall back to `date-fns-jalali` for formatting in L3; tests assert fixed strings. |
| A8 | No timezone is assumed. Evidence today (inspected 2026-10-21): `listMovementsQuerySchema` has only `page` and `limit`; the `from` and `to` filters exist only as a spec line in sub-PRD 08 (`GET /movements?...&from=&to=`) with no stated meaning (inclusive or not, timezone); movement `createdAt` values are Mongo UTC instants; no timezone setting exists in the server, client or docs; the client shows times in the browser's local zone (`Intl` default). The timezone is chosen in L3 by the procedure in 3.8. | A filter could return a day too many or too few around midnight; see U6. |
| A9 | The existing contract `{ message, code, errors, details }` and the client `ApiError` (`status`, `code`, `errors`, `details`, `message`) are consumed by forms and toasts today and must keep working unchanged for any code the catalogue does not know. | Forms or toasts would break for old responses; L5 tests cover it. |
| A6 | The ~86 Zod messages in `shared/schemas` and ~50 `AppError(` call sites can each map to a code without changing their behavior. | Split L5 into smaller PRs. |
| A7 | Telegram's `language_code` is present on incoming updates for most users; when absent the bot answers in English. | Same fallback, no change. |

---

## 3. Changes

### 3.1 Scope

In: client i18n setup, RTL layout, Persian digits and Jalali display, moving existing client strings to translation keys, the shared error-code catalogue, translated emails and Telegram bot messages, the `language` field with seed and tests. Out: translating user-entered content, a Jalali calendar in storage or the API, languages other than `en` and `fa`.

### 3.2 Phases

| Phase | Branch | Scope |
|---|---|---|
| L0 | `docs/plan-phase-l` | This plan, then GitHub issues for L1 to L5 once approved. No code. |
| L1 | `feat/i18n-setup` | Add `react-i18next`, `en` and `fa` resource files, a language provider, header switcher, Profile setting. Add `language` to the User model, shared schema, seed (mix of `en` and `fa` users) and `seed.test.js`. The signed-in user changes it through the existing profile update (`updateProfileSchema` today only carries `name`). Registration sends the browser's chosen language so the **verification email** (sent before any login) is already in the right language; a Telegram sign-up starts from Telegram's `language_code`, else `en`. Logged-out choice saved in browser storage; logged-in choice saved on the user. |
| L2 | `feat/i18n-rtl` | `dir` and `lang` on `<html>` follow the language. Logical CSS properties (start and end) in the tokens, `ui/` components and the shell. Self-hosted Vazirmatn for `fa`. Browser pass at about 360, 768, 1024 and 1280 px in both languages. |
| L3 | `feat/i18n-formatting` | Persian digits and locale formatting for quantities, prices, dates and pagination (extends `client/src/lib/format.js`). Jalali display and Jalali date pickers (library decided here, Q9). Digit-normalising input helper (Q14). Stored values unchanged. |
| L4 | `feat/i18n-client-strings` | Move all existing client strings onto translation keys, `en` and `fa`. Existing tests run with the fixed `en` language. Targeted `fa` tests per area. Parity test for the key files. |
| L5 | `feat/i18n-server-codes` | Shared error-code catalogue. Zod messages and `AppError` responses carry codes; the client translates them. Emails (`mail.templates.js`) and bot messages (`bot.js`, `userNotify.service.js`) pick the recipient's language, with Telegram `language_code` before linking. Catalogue-coverage test. |

L1 to L3 are infrastructure and can be reviewed independently. L4 is the largest by lines changed. L5 is the only phase that changes API response shapes (adds `code`; `message` stays).

### 3.3 Behavior and edge cases

- Language resolution on the client: user record (logged in) > browser storage > browser language (`fa` maps to Persian) > `en`.
- Switching language re-renders immediately and, when logged in, saves to the user record; a failed save keeps the UI language and shows a translated error.
- Email and bot language come from the recipient's record at send time. A missing or unknown value means English.
- A missing translation key falls back to English in the UI and fails the parity test in CI.
- Persian digits are display only. Copying a value still gives the displayed text; the input helper accepts either digit set when typing or pasting.
- CSV export (M8) and every API payload keep ISO dates and Latin digits.

### 3.4 Data and seed

- `User.language`: `en` or `fa`, default `en`.
- Seed: cover both languages across the existing role and status users; `seed.test.js` checks every seeded user has a valid language and that both values appear.
- No other models change.

### 3.5 Testing

- Client: fixed `en` for existing suites; targeted `fa` tests for switcher, direction, digits, Jalali formatting and one translated form error per area.
- Shared: catalogue test (every code has an English default and both client translations).
- Server: user language update, language used for email and bot messages, fallback cases. Existing error-code assertions keep passing.
- Seed test as in 3.4.

### 3.6 Approval and workflow

- Phase L stays deferred in `tasks/task.md` until the owner approves this plan; issues are created only after that.
- **One branch and one PR per phase, one commit per ticket.** Each phase L1 to L5 is a single GitHub issue, so it gets one commit titled `feat: <issue title> (#<issue>)` on its own `feat/` branch. A phase PR therefore holds one commit. If a phase proves too large for one commit, split it into **sub-issues** (for example L4 by area) rather than adding several commits for one issue; each sub-issue is still one commit, and the PR for that phase lists them in order. This keeps the CLAUDE.md rule intact.
- Tickets are built one at a time with `/mattpocock-skills:implement #<issue>`, each in a fresh session, with `npm run lint` and `npm test` before committing. The ticket session does not push, open a PR, or close the issue; the owner pushes and opens each phase PR, and issues close when the milestone PR merges.
- Later phases branch off `sub-prds` after the previous phase's PR has merged, so they never stack on unmerged work.
- L0 (this plan and its issues) is documentation only and is the one place a plan commit and issue creation are done outside `/implement`, only after the owner says so.

- **Untracked build cache.** `client/.vite/` (`deps/_metadata.json`, `deps/package.json`) is Vite's dependency-optimisation cache, generated when the client dev server or tests run (inspected 2026-10-21: `"optimized": {}`, a one-line `{"type":"module"}` package file). It is untracked and not covered by `.gitignore` (which lists `node_modules/`, `dist/` and similar). It is **not part of this work**: the plan commit stages only `docs/plans/phase-l-multilingual.md` and `tasks/task.md`, by explicit path (never `git add -A`). Adding `.vite/` to `.gitignore` is a separate one-line change for the owner to approve.

### 3.7 Error-code contract (L5)

Today a response is `{ message, code, errors?, details? }`: `code` is a coarse `AppError` code (for example `IN_USE`, `VALIDATION_ERROR`), `errors` maps each field to an English message, and `ApiError` on the client copies `message`, `code`, `errors` and `details`. Rules for adding stable codes:

- **Additive only.** `message`, `code`, `errors` (field to English message), `details` and the status codes keep their current shape and meaning. Existing clients and tests keep working. New information goes in **new optional fields** (for example `errorCodes`: field to stable code), never by changing the type of an existing one.
- **The shared catalogue is the source of truth.** `shared/` holds the catalogue: every code with its English default text. Server and client import it. A static test scans the server for `new AppError(status, 'CODE'` literals and the shared schemas for their messages and fails if any is missing from the catalogue; another fails if a code lacks an `en` or `fa` client translation.
- **Safe fallback for unknown codes.** The client translates with the code, then falls back to the server's English `message`, then to a translated generic "Something went wrong". An unknown or missing code never throws and never shows a raw key. The server falls back to `VALIDATION_INVALID` for a validation message not in the catalogue.
- **Interpolation uses `details`.** Values such as counts (`productCount`, `movementCount`) come from `details`, not from parsing the message text.
- **Non-API English strings.** Client-side text such as the network-error message in `client/src/lib/api.js` moves onto translation keys in L4.

**Concrete design (decided now, built in L5).**

1. **Catalogue.** `shared/errorCodes.js` exports a frozen map `{ CODE: 'English default text' }` and two helpers: `messageFor(code)` and `codeForMessage(text)` (reverse lookup). A test requires every English default to be unique, so the reverse lookup is unambiguous.
2. **`AppError` responses.** The `code` strings that exist today (`IN_USE`, `DUPLICATE_NAME`, `INSUFFICIENT_STOCK`, `VALIDATION_ERROR`, and so on) are already stable, so none are renamed. L5 registers each of them in the catalogue. Status codes, `message`, `errors` and `details` are unchanged. A code that today covers several different message texts keeps its code and is told apart by `details` or, if needed, gets a new more specific code added next to it.
3. **Zod messages.** Schemas in `shared/schemas` stop using string literals for `message` and take them from the catalogue (`m.PASSWORD_MIN`, and so on), so each message is exactly a catalogue English default. An ESLint `no-restricted-syntax` rule scoped to `shared/schemas` rejects string-literal `message` values, so a new schema cannot skip the catalogue. The `validate` middleware keeps building `errors` (field to English message) exactly as today, and additionally builds a new optional `errorCodes` (field to code) using `codeForMessage`. The top-level `code` stays `VALIDATION_ERROR`.
4. **Unmapped validation messages.** If a message is not in the catalogue (for example a Zod default such as "Required"), its field gets code `VALIDATION_INVALID` and `errors` still carries the original text. Nothing fails and nothing is hidden.
5. **Client.** `ApiError` gains an `errorCodes` property; all existing properties stay as they are. Display order: `t('errors.<code>', details)` when the code has a translation, else the server's English text (`errors[field]` or `message`), else the translated generic "Something went wrong". An unknown or missing code never throws and never shows a raw key.
6. **Translation files.** `en` error texts come from the catalogue itself (no second copy that can drift). Only `fa` is a separate file keyed by catalogue codes.
7. **Tests (the catalogue stays the source of truth).** (a) Every catalogue code has an `fa` translation; (b) every `fa` error key exists in the catalogue (no orphans); (c) a scan of `server/src` finds every `new AppError(status, 'CODE'` literal in the catalogue; (d) English defaults are unique; (e) per-schema tests confirm that invalid input produces both the old `errors` map and the new `errorCodes`; (f) a **backward-compatibility test** feeds the client a response with no `errorCodes` (the current shape) and checks forms and toasts still show the English text; (g) an unknown-code test checks the fallback chain in item 5.
8. **Compatibility.** Existing server tests that assert `message`, `code` and `errors` keep passing unchanged. They are the proof that the contract was only extended.

Remaining detail left to L5 is naming only (the exact code names for each schema message), not the approach.

### 3.8 Date-range timezone (decided in L3, with M8.1)

The timezone is **not chosen in this plan**. At the start of L3 the assistant collects this evidence and the owner decides:

1. **API today.** Re-read `shared/schemas/stock.js`, the movements service and any M8.1 work already merged, to see what `from` and `to` actually accept (date-only `YYYY-MM-DD` or full ISO instants) and whether a filter exists yet.
2. **M8 requirements.** Re-read sub-PRD 08 (3.1 Filters and the `GET /movements` line) and the CSV export section: the Movements page filters, the CSV of the filtered result, and the Users drawer link that pre-filters by user must all agree on one meaning of a date range.
3. **Stored data.** Confirm `createdAt` values are UTC instants and how the seed generates timestamps, so tests can use fixed instants.
4. **Display.** Confirm what zone the client shows (browser local today) and whether the Jalali display uses the same zone.
5. **Options compared.** (a) The client converts the chosen Jalali days to UTC instants in the browser's zone and sends full ISO instants, so the API stays timezone-agnostic and `to` is an exclusive end; (b) the client sends date-only values and the server applies one configured zone; (c) plain UTC days. Each is checked against the cases: a movement at 23:30 and at 00:30 local time on the boundary day, a range of one day, a range across a Jalali month end and across the Gregorian year end, and the CSV export of the same range.
6. **Output.** The chosen option, the meaning of `from` and `to` (inclusive or exclusive), and the boundary test cases above recorded in the L3 ticket and used as tests in M8.1.

**Findings at L3 (2026-10-21):** (1) the movements list still accepts only `page` and `limit`, so no `from`/`to` behaviour exists to preserve; (2) sub-PRD 08 names the filters but not their meaning; (3) `createdAt` is a UTC instant; (4) the client displays the browser's local time, in both languages. **Recommendation for M8.1 (owner decides):** option (a), the client turns the chosen days into UTC instants using the browser's zone and sends full ISO values, with `from` inclusive and `to` exclusive (the start of the day after the last chosen day). This keeps the API free of timezone settings and matches what the table displays. The boundary cases above become M8.1 tests. L3 builds no filter and sets no zone.

Until the owner decides, no code, schema or doc assumes a zone.

---

## 4. Unknowns

| # | Unknown | Resolved by |
|---|---|---|
| U1 | **Resolved in L3 (2026-10-21):** the installed picker has an official add-on, `@daypicker/persian` 10.0.2 (same version as `@daypicker/react`), which renders the Jalali calendar right to left with Persian digits and returns ordinary `Date` values. `calendar.jsx` uses it when the language is Persian. Text formatting uses `Intl` (`fa-IR-u-ca-persian`). No extra date library of our own was needed. | Closed. |
| U5 | Exact code names for each shared schema message and any extra `AppError` codes (the approach itself is decided in 3.7). | Assistant proposes the list in the L5 ticket; owner reviews it in the PR. |
| U6 | Timezone for "start and end of day" in Movements date-range filters, and whether `to` is inclusive. Deferred to L3; evaluated by the procedure in 3.8, not assumed. | Assistant gathers the evidence in 3.8 at the start of L3; owner decides. |
| U2 | Exact Persian wording for statuses, roles and stock terms (glossary-level terms such as "Receive", "Ship", "Adjust"). | Owner's review of the first `fa` drafts in L1/L4. |
| U3 | Whether the header switcher is a toggle or a menu, and its position at 360 px width. | L1 design, checked in the L2 browser pass. |
| U4 | Whether `GLOSSARY.md` gets Persian equivalents for domain terms. | Owner, during L4 review. |
