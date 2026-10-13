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

| Phase | Task | Status |
|---|---|---|
| 3.1 | AuthRequest model (expires automatically) and seed data | ⬜ To do |
| 3.2 | OTP service: 6-digit codes, stored hashed, 2-minute expiry, 3 attempts, 60-second resend | ⬜ To do |
| 3.3 | Telegram bot with the `/start <token>` handler (polling in development, webhook in production) | ⬜ To do |
| 3.4 | `POST /auth/telegram/start`, `GET /auth/telegram/status`, `POST /auth/telegram/verify` | ⬜ To do |
| 3.5 | Telegram part of the Login page: deep link, polling, OTP input with countdowns | ⬜ To do |
| 3.6 | Complete profile endpoints, covering all three email-collision cases | ⬜ To do |
| 3.7 | `POST /auth/link-telegram/confirm`: all-or-nothing in one transaction, removes the placeholder user | ⬜ To do |
| 3.8 | CompleteProfile and ConfirmLink pages | ⬜ To do |
| 3.9 | Connect Telegram endpoints (`link/start`, `link/verify`) and `PATCH /auth/profile` | ⬜ To do |
| 3.10 | Profile page | ⬜ To do |

## M4: Roles, access gates and user approval [sub-PRD 04](../docs/prds/04-roles-approval.md)

| Phase | Task | Status |
|---|---|---|
| 4.1 | `requireProfile`, `requireActive` and `requireRole` middleware (`PROFILE_INCOMPLETE`, `ACCOUNT_PENDING`, 403) | ⬜ To do |
| 4.2 | Admin bootstrap from `ADMIN_EMAILS` and `ADMIN_TELEGRAM_IDS` | ⬜ To do |
| 4.3 | User status service: transitions, change history, ending sessions on rejection, the last-admin rule | ⬜ To do |
| 4.4 | Approve and reject notifications by email and Telegram bot | ⬜ To do |
| 4.5 | Users API: `GET /users`, `PATCH /users/:id/status`, `PATCH /users/:id/role`, `GET /users/pending-count` | ⬜ To do |
| 4.6 | Users page: Pending, Active and Rejected tabs, table, actions | ⬜ To do |
| 4.7 | User detail drawer: status history and a link to the user's movements | ⬜ To do |
| 4.8 | Pending-count badge in the navigation, plus guards for incomplete profiles and admin-only pages | ⬜ To do |

## M5: Categories and suppliers [sub-PRD 05](../docs/prds/05-categories-suppliers.md)

| Phase | Task | Status |
|---|---|---|
| 5.1 | Categories API (409 on delete while any product uses it, archived products included) | ⬜ To do |
| 5.2 | Categories page: card grid, admin add/edit/delete, read-only for staff | ⬜ To do |
| 5.3 | Suppliers API: search, sort, pagination, deactivate and reactivate, 409 on delete while in use | ⬜ To do |
| 5.4 | Suppliers page: table, form, admin actions | ⬜ To do |

## M6: Products catalog [sub-PRD 06](../docs/prds/06-products.md)

| Phase | Task | Status |
|---|---|---|
| 6.1 | Products list API: search, filters, sort, pagination, indexes, under 300 ms at 10,000 products | ⬜ To do |
| 6.2 | Create and edit product API (SKU unique regardless of case, quantity not editable) | ⬜ To do |
| 6.3 | Archive and restore API, admin only | ⬜ To do |
| 6.4 | Products page table, with search, filters, sort and page kept in the URL | ⬜ To do |
| 6.5 | Add and Edit product form | ⬜ To do |
| 6.6 | Archive and restore in the UI, with a confirm dialog | ⬜ To do |

## M7: Stock engine and history [sub-PRD 07](../docs/prds/07-stock-engine.md)

| Phase | Task | Status |
|---|---|---|
| 7.1 | `stock.service`: one atomic update and its movement in one transaction, with concurrency tests | ⬜ To do |
| 7.2 | `POST /products/:id/stock` and `GET /products/:id/movements` | ⬜ To do |
| 7.3 | Initial stock when a product is created ("Initial stock" receive in the same transaction) | ⬜ To do |
| 7.4 | Inline +/- buttons: optimistic update, rollback on error, rapid clicks queued | ⬜ To do |
| 7.5 | Adjust stock modal (Receive, Ship, Adjust) | ⬜ To do |
| 7.6 | Stock history modal | ⬜ To do |

## M8: Movements, dashboard and CSV export [sub-PRD 08](../docs/prds/08-movements-dashboard-export.md)

| Phase | Task | Status |
|---|---|---|
| 8.1 | Movements API with filters (product, type, supplier, user, date range) | ⬜ To do |
| 8.2 | Movements page | ⬜ To do |
| 8.3 | Dashboard API: summary, low-stock list, recent movements | ⬜ To do |
| 8.4 | Dashboard page, including the Pending approvals card for admins | ⬜ To do |
| 8.5 | CSV export for products and movements, with formula-injection escaping | ⬜ To do |
| 8.6 | SMTP (Brevo) configuration and the final test pass | ⬜ To do |

---

## Notes
- The root `CLAUDE.md` contains the server rules. Its first line says it "applies in addition to the root `CLAUDE.md`", so it may have been meant for `server/CLAUDE.md`. This hasn't been changed yet.
- Run locally: `npm run db:dev -w server` (local replica set), `npm run seed -w server`, then `npm run dev` (API on :4000, client on :5173).
