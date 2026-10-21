# Inventory App Tasks

The Inventory App is built in small phases, following the eight sub-PRDs in `docs/prds/`. If a sub-PRD and `docs/prds/PRD.md` disagree, `PRD.md` wins.

**Repo:** `C:\Users\hp\Desktop\Inventory-App-Ai` (current branch `feat/auth-password-reset`)
**Stack:** React (Vite), Tailwind, shadcn/ui, TanStack Query and Table, Node.js, Express, MongoDB with Mongoose (replica set), Zod in `shared/schemas`

## Working rules
- Make one change per phase. After each phase, run `npm run lint` and `npm test`, report the files changed and the check results, then wait for approval before the next phase.
- Follow `CLAUDE.md`: business logic goes in services, every write uses `validate` with a shared Zod schema, and errors use `AppError`.
- Every phase that adds or changes a model also updates the seed data (`server/seed/data/*.js`) and `server/tests/seed/seed.test.js`.
- Use one branch per sub-PRD or task: `feat/<area>-<short-name>`. Don't commit to `main`.
- Don't commit, push or deploy unless asked.

## Starting point (2026-10-12)
This comes from reading the code; the tests haven't been run.
- **01 Foundation:** mostly built: server, middleware, client shell and test setup. Missing: the reusable `data-table`.
- **02 Email auth:** register, email verification, login, refresh, logout and `/me` are built. Missing: forgot and reset password.
- **03 Telegram:** not started.
- **04 Roles:** the client route guards and the Awaiting approval page exist. Missing: the server gates, admin bootstrap and Users management.
- **05–08:** the Category, Supplier, Product and StockMovement models and the seed data exist. Missing: their APIs and pages.

## Scaffold (2026-10-12)
- **Dependencies:** all the libraries the PRD needs are installed. Client: Radix dialog, select, tabs, dropdown-menu, alert-dialog and popover; `lucide-react`, `cmdk`, `input-otp`, `@daypicker/react`, `date-fns`, `react-hot-toast`, `axios` (the API client in `lib/api.js`). Server: `grammy`.
- **shadcn components** in `client/src/components/ui`: badge, dialog, sheet, alert-dialog, select, tabs, dropdown-menu, popover, command, input-otp, calendar and a `react-hot-toast` toaster (`toaster.jsx`), with smoke tests in `ui.test.jsx`.
- **Placeholder folders**, each with a README: `client/src/components/{products,categories,suppliers,users}`, `client/src/mocks` and `server/src/bot`.

---

## M1: Foundation (finish) [sub-PRD 01](../docs/prds/01-foundation.md)

| Phase | Task | Status |
|---|---|---|
| 1.1 | Add TanStack Table and the shadcn Table component | ✅ Done |
| 1.2 | Build the reusable `data-table` (sort, pagination, toolbar), with a test | ✅ Done |
| 1.3 | Switch the API client to Axios: one instance with a response interceptor for errors and refresh-and-retry; `api()` and `ApiError` unchanged; docs updated | ✅ Done |

## M2: Password reset [sub-PRD 02](../docs/prds/02-auth-email-sessions.md)

| Phase | Task | Status |
|---|---|---|
| 2.1 | `POST /auth/forgot-password`: same generic response every time, limited to 5 per hour per email and per IP | ✅ Done |
| 2.2 | `POST /auth/reset-password`: single-use 30-minute link, ends all sessions, sends a "password changed" email, doesn't log the user in | ✅ Done |
| 2.3 | ForgotPassword page, with a 60-second resend countdown | ✅ Done |
| 2.4 | ResetPassword page | ✅ Done |

## M3: Telegram login and identity linking [sub-PRD 03](../docs/prds/03-telegram-identity.md)

Clarified on 2026-10-13, edge cases settled on 2026-10-14 (decisions in sub-PRD 03 and PRD 1.5, terms in `GLOSSARY.md`). Branch: `feat/telegram-identity`.

**Tracked as GitHub issues, not in this table.** M3 is split by `/to-tickets` into vertical-slice issues with blocking links on `FatemehYafteh/Inventory-App`, and each issue is built with `/implement #<issue>` (`/clear` between issues). Progress lives on the issues.

Issues (blocking links are native on GitHub):
- [#1](https://github.com/FatemehYafteh/Inventory-App/issues/1) Telegram sign-in, happy path in development
- [#2](https://github.com/FatemehYafteh/Inventory-App/issues/2) One-time code policy and refusals. Blocked by #1
- [#3](https://github.com/FatemehYafteh/Inventory-App/issues/3) Real Telegram bot (polling and webhook). Blocked by #2
- [#4](https://github.com/FatemehYafteh/Inventory-App/issues/4) Complete profile, case 1. Blocked by #1
- [#5](https://github.com/FatemehYafteh/Inventory-App/issues/5) Account link (cases 2 and 3, rejected emails). Blocked by #4
- [#6](https://github.com/FatemehYafteh/Inventory-App/issues/6) Profile page
- [#7](https://github.com/FatemehYafteh/Inventory-App/issues/7) Connect Telegram. Blocked by #2 and #6

## M4: Roles, access gates and user approval [sub-PRD 04](../docs/prds/04-roles-approval.md)

Branch: `feat/roles-approval` (off `feat/telegram-identity`). **Tracked as GitHub issues**, built with `/mattpocock-skills:implement #<issue>`; the table below maps each task to its issue:
- [#9](https://github.com/FatemehYafteh/Inventory-App/issues/9) Access gates and Awaiting approval (4.1, 4.5 screen, 4.8 guards)
- [#10](https://github.com/FatemehYafteh/Inventory-App/issues/10) Admin bootstrap and the StatusChange model (4.2)
- [#11](https://github.com/FatemehYafteh/Inventory-App/issues/11) User status and role changes (4.3, 4.4, 4.5 API). Blocked by #9 and #10
- [#12](https://github.com/FatemehYafteh/Inventory-App/issues/12) Users page (4.6, 4.8 badge). Blocked by #11
- [#13](https://github.com/FatemehYafteh/Inventory-App/issues/13) User detail drawer (4.7). Blocked by #12

| Phase | Task | Status |
|---|---|---|
| 4.1 | `requireProfile`, `requireActive` and `requireRole` middleware (`PROFILE_INCOMPLETE`, `ACCOUNT_PENDING`, 403) | ✅ Done |
| 4.2 | Admin bootstrap from `ADMIN_EMAILS` and `ADMIN_TELEGRAM_IDS` | ✅ Done |
| 4.3 | User status service: transitions, change history, ending sessions on rejection, the last-admin rule | ✅ Done |
| 4.4 | Approve and reject notifications by email and Telegram bot | ✅ Done |
| 4.5 | Users API: `GET /users`, `PATCH /users/:id/status`, `PATCH /users/:id/role`, `GET /users/pending-count` | ✅ Done |
| 4.6 | Users page: Pending, Active and Rejected tabs, table, actions | ✅ Done |
| 4.7 | User detail drawer: status history and a link to the user's movements | ✅ Done |
| 4.8 | Pending-count badge in the navigation, plus guards for incomplete profiles and admin-only pages | ✅ Done |

## M5: Categories and suppliers [sub-PRD 05](../docs/prds/05-categories-suppliers.md)

| Phase | Task | Status |
|---|---|---|
| 5.1 | Categories API (409 on delete while any product uses it, archived products included) | ✅ Done |
| 5.2 | Categories page: card grid, admin add/edit/delete, read-only for staff | ✅ Done |
| 5.3 | Suppliers API: search, sort, pagination, deactivate and reactivate, 409 on delete while in use | ✅ Done |
| 5.4 | Suppliers page: table, form, admin actions | ✅ Done |

## M6: Products catalog [sub-PRD 06](../docs/prds/06-products.md)

| Phase | Task | Status |
|---|---|---|
| 6.1 | Products list API: search, filters, sort, pagination, indexes, under 300 ms at 10,000 products | ✅ Done |
| 6.2 | Create and edit product API (SKU unique regardless of case, quantity not editable) | ✅ Done |
| 6.3 | Archive and restore API, admin only | ✅ Done |
| 6.4 | Products page table, with search, filters, sort and page kept in the URL | ✅ Done |
| 6.5 | Add and Edit product form | ✅ Done |
| 6.6 | Archive and restore in the UI, with a confirm dialog | ✅ Done |

## Design Foundation (before 6.4): UI only, no API, auth, permission or validation changes

| Phase | Task | Status |
|---|---|---|
| D0 | Add this section to `tasks/task.md` | ✅ Done |
| D1 | Tokens for light and dark themes (app stays light, dark not activated): colours (primary `#2563EB`, hover `#1D4ED8`, navy `#0F1E3D` light and `#0B1426` dark), success, warning, danger, radius, system font stack, tabular numbers, static light `theme-color`, contrast test | ✅ Done |
| D2 | Components on tokens: `success`, `warning` and `danger` badge variants; button hover, input and select placeholders, full-strength focus rings on the `ui/` components, overlays, toaster icons, `FormAlert` and the danger text on tokens; source guard in `ui.test.jsx` | ✅ Done |
| D3 | Shell: navy sidebar from `lg`, navy top bar with a `Sheet` menu below it, skip link, `MinimalLayout`, Categories grid on container queries | ✅ Done |
| D4 | `PageHeader` and `StatusBadge`: the five page headings (Categories, Dashboard, Not found, Suppliers, Users) on `PageHeader`; status badges on Users, the user drawer and Suppliers on `StatusBadge` (same text, colour from the status) | ✅ Done |
| D5 | Browser pass at about 360, 768, 1024 and 1280 px as admin, staff, pending and rejected (written report, in chat) | ✅ Done |
| D6 | `docs/design-system.md` and a tokens-only rule in `client/CLAUDE.md` | ✅ Done |
| D7 | Profile page on the design system: `PageHeader`, one card per section (Name, Sign-in methods, Password), `max-w-3xl` column, long emails wrap | ✅ Done |
| D8 | Profile page redesign: identity card with avatar, role and status badges; two-column layout from `lg`; sign-in methods with badges; long names and emails wrap | ✅ Done |
| T | Theme switching and persisted user preference (applies the `.dark` class); planned after M8 and before UI polish, on its own branch and PR (see "Planned order"). DEFERRED: do NOT start without the owner's explicit approval | ⬜ Not started |

## M7: Stock engine and history [sub-PRD 07](../docs/prds/07-stock-engine.md)

| Phase | Task | Status |
|---|---|---|
| 7.1 | `stock.service`: one atomic update and its movement in one transaction, with concurrency tests | ✅ Done |
| 7.2 | `POST /products/:id/stock` and `GET /products/:id/movements` | ✅ Done |
| 7.3 | Initial stock when a product is created ("Initial stock" receive in the same transaction) | ✅ Done |
| 7.4 | Inline +/- buttons: optimistic update, rollback on error, rapid clicks queued | ✅ Done |
| 7.5 | Adjust stock modal (Receive, Ship, Adjust) | ✅ Done |
| 7.6 | Stock history modal | ✅ Done |

## M8: Movements, dashboard and CSV export [sub-PRD 08](../docs/prds/08-movements-dashboard-export.md)

| Phase | Task | Status |
|---|---|---|
| 8.1 | Movements API with filters (product, type, supplier, user, date range). Date-range meaning: Option A decided 2026-10-21, see `docs/plans/m8-date-range-timezone.md` | ✅ Done |
| 8.2 | Movements page | ✅ Done |
| 8.3 | Dashboard API: summary, low-stock list, recent movements | ✅ Done |
| 8.4 | Dashboard page, including the Pending approvals card for admins | ✅ Done |
| 8.5 | CSV export for products and movements, with formula-injection escaping | ✅ Done |
| 8.6 | SMTP (Brevo) configuration and the final test pass | ⬜ To do |

## Phase L: Multilingual support (English and Persian). DEFERRED: plan and issues first; do NOT start without the owner's explicit approval

Planned after M7 (7.3 to 7.6) and before M8, so M8 is built with translation keys from the start. Persian must support right-to-left (RTL) layout and Persian digits (۱۲۳); English stays left-to-right (LTR) with Latin digits. The plan and GitHub issues are written and approved before any implementation.

| Phase | Task | Status |
|---|---|---|
| L0 | Write the plan (`docs/plans/phase-l-multilingual.md`) and create the GitHub issues; settle the open points below | ✅ Done: plan committed, issues #34 to #38 created |
| L1 | i18n setup in the client: library, translation files for `en` and `fa`, language switcher, preference saved per user | ✅ Done (#34) |
| L2 | RTL layout: `dir` and `lang` follow the language; logical CSS properties (start/end) in the tokens, `ui/` components and shell; browser pass at about 360, 768, 1024 and 1280 px in both languages | ✅ Done (#35). Browser pass done 2026-10-21 in headless Chrome at 360, 768, 1024 and 1280 px, English and Persian, on all signed-in and signed-out pages: no horizontal overflow, correct direction and font; one clipped Persian filter label fixed |
| L3 | Persian digits and locale formatting for quantities, prices, dates and pagination (stored values stay unchanged) | ✅ Done (#36) |
| L4 | Move the existing client strings onto translation keys and fix the tests to run in a fixed language | ✅ Done (#37). Persian texts are drafts for the owner to proofread; checks and open choices in `docs/plans/phase-l-persian-review.md` |
| L5 | Server and shared messages: stable error codes translated on the client (affects the Zod messages in `shared/schemas` and `AppError` responses) | ✅ Done (#38) |

Open points for L0, settled in the plan (2026-10-21): emails and the Telegram bot are translated; Persian font is Vazirmatn (self-hosted); the language preference lives on the user record (seed and its test updated) plus the browser for logged-out pages. The error-code approach is decided in section 3.7 of the plan (additive `errorCodes`, shared catalogue, safe fallbacks). Still open, with who resolves them: see section 4 of `docs/plans/phase-l-multilingual.md` (Jalali library at L3, date-range timezone at L3 by the procedure in 3.8, exact code names at L5).

## Planned order of the remaining work (agreed 2026-10-21)

1. **7.3**: only after the owner's explicit approval.
2. **7.4 to 7.6**: finish M7.
3. **Phase L**: multilingual support, plan and issues first.
4. **M8**: built with translation keys from the start.
5. **Phase T**: theme switching and dark mode, after M8 and before UI polish, on its own branch and PR.
6. **UI polish**.

Nothing in this order changes an approval requirement: 7.3, Phase L and Phase T each stay deferred until the owner says to start them.

---

## Notes
- The root `CLAUDE.md` contains the server rules. Its first line says it "applies in addition to the root `CLAUDE.md`", so it may have been meant for `server/CLAUDE.md`. This hasn't been changed yet.
- Run locally: `npm run db:dev -w server` (local replica set), `npm run seed -w server`, then `npm run dev` (API on :4000, client on :5173).
