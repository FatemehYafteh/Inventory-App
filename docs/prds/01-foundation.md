# Sub-PRD 01: Foundation and Platform

**Parent:** [PRD.md](PRD.md) sections 2, 6 (conventions), 8, 9, 10
**Milestone:** 1
**Depends on:** none

## 1. Goal

Set up the repository, the Express + MongoDB server, the shared Zod package and the client layout shell so every later slice plugs into a working, tested skeleton.

## 2. Scope

### In scope
- Monorepo layout: `client/`, `server/`, `shared/schemas`.
- Server skeleton: `app.js` (builds the app, registers routers), `index.js` (starts the server and optionally the bot), env validation that fails fast.
- MongoDB connection through Mongoose. A **replica set** is required (transactions), both locally and in tests.
- Cross-cutting middleware: `validate` (Zod), `error` (single `AppError` handler), `rateLimit`, `csrf` (Origin check + required `X-Requested-With`), helmet, strict same-site CORS.
- Client shell: Vite + React, Tailwind, shadcn/ui, React Router, TanStack Query client, an Axios API client (its refresh-retry interceptor is added in 02), app layout with navigation.
- Reusable `data-table` component (TanStack Table in manual/server mode: header sort, pagination, toolbar) rendered with shadcn Table.
- Tooling: ESLint, Prettier, test runner (Vitest or Jest), supertest, mongodb-memory-server started as a replica set.
- `server/.env.example` listing every variable below.

### Out of scope
- Any auth, domain model or page content (later slices).

## 3. Tech stack

| Layer | Choice |
|---|---|
| Client | React (Vite), Tailwind CSS, shadcn/ui, React Router |
| Server state | TanStack Query |
| HTTP client | Axios (one instance with response interceptors) |
| Tables | TanStack Table, manual server-side mode, shadcn Table |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| Validation | Zod, shared by client and server |
| Server | Node.js, Express, ES modules, async/await |
| Database | MongoDB + Mongoose (replica set) |
| Bot | grammY (or node-telegram-bot-api) |
| Auth | JWT access + refresh in httpOnly cookies; Argon2id (or bcrypt) |
| Email | Nodemailer over SMTP, no provider-specific code |

## 4. API conventions

- All routes under `/api`, JSON.
- Error shape: `{ message, code?, errors? }`. List shape: `{ data, page, limit, total }`.
- Zod validation middleware on every write endpoint.
- Defined error codes include `PROFILE_INCOMPLETE`, `ACCOUNT_PENDING`, `INSUFFICIENT_STOCK`.
- In `NODE_ENV=test` only, the `x-test-user` header may simulate an authenticated user. It must not exist in production builds.

## 5. Environment variables

`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE`, `CLIENT_ORIGIN`, `APP_URL`, `TRUST_PROXY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_MODE`, `ADMIN_TELEGRAM_IDS`, `ADMIN_EMAILS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`

Startup validates them. Missing required values stop the server with a clear message. (SMTP is optional in development, required in production; see 02.)

## 6. Suggested structure

```
shared/schemas          (Zod: product, category, supplier, stock, auth, profile)
client/src
  components/ui         (shadcn)
  components/data-table (reusable TanStack Table wrapper)
  pages, lib, hooks
server/src
  app.js, index.js, config/, models/, routes/, controllers/, services/, middleware/, bot/, utils/
server/tests            (mirrors src/)
```

## 7. Non-functional requirements (apply to all slices)

- **Performance:** product list under 300 ms at 10,000 products (indexes are defined in the owning slices).
- **Security:** helmet, rate limiting, strict same-site CORS, input validation and sanitization, no secrets in the client, all secrets in env vars.
- **Accessibility:** keyboard-navigable tables, dialogs and OTP input; labels; status not conveyed by colour alone.
- **Responsive:** usable on tablet and mobile.
- **Quality:** ESLint/Prettier, unit + integration + basic component tests.

## 8. Acceptance criteria

- `npm run dev` starts client and server; the server connects to a Mongo replica set.
- Server refuses to start when a required env variable is missing.
- A test suite runs against mongodb-memory-server in replica-set mode, and a sample transaction succeeds.
- A request with an invalid body to a sample write route returns 400 `{ message, errors }` from the shared schema.
- A state-changing request without `X-Requested-With` or with a foreign `Origin` is rejected.
- Unhandled errors return a generic message with no stack trace.
- The client shows the layout shell and navigation, and the data-table component renders sample data with sort and pagination controls.
