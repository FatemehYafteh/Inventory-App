# Server rules (Node.js, Express, Mongoose)

Applies in addition to the root `CLAUDE.md`. Requirements: `docs/PRD.md` sections 3, 4, 5, 6, 7.

## Structure
```
server/src/
  app.js              builds the Express app and registers every router
  index.js            starts the server and (optionally) the Telegram bot
  config/             env validation (fail fast), cookie and CORS config
  models/             Mongoose models (User, StatusChange, AuthRequest, EmailToken, RefreshToken, Category, Supplier, Product, StockMovement)
  routes/             route definitions only (path, middleware, controller)
  controllers/        thin: parse request, call a service, send response
  services/           ALL business logic (stock, auth, otp, token, password, mail, account-link, user-status)
  middleware/         auth, requireProfile, requireActive, requireRole, protect (the composed gate chain), validate, rateLimit, csrf, error
  bot/                Telegram bot and /start handler
  utils/
tests/                mirrors src/, supertest + mongodb-memory-server (replica set)
```

## Conventions
- ES modules, async/await, no callbacks. Controllers never touch models directly for business rules; they call services.
- Every write endpoint uses the `validate` middleware with a Zod schema from `shared/schemas`.
- One error class (`AppError(status, code, message, errors, details)`) and one error-handler middleware. `errors` are field-level validation messages; `details` is an optional object of safe values the service computed (such as `{ productCount }` on `IN_USE`), included in the body only when set. Never leak stack traces or internal details.
- Auth endpoints that can reveal whether an account exists (register, forgot-password, resend, complete profile) return the same generic response in every case.
- Hash OTPs, refresh tokens, start tokens and email tokens before storing. Compare in constant time.
- Cookies: `access_token` (15 min, path `/`) and `refresh_token` (7 days, path `/api/auth`), both `HttpOnly; SameSite=Strict`, `Secure` when `COOKIE_SECURE=true`. Set them through `Set-Cookie` headers, never in the body.
- CSRF defence on state-changing routes: Origin check + required `X-Requested-With` header.
- Rate limit all public auth routes (per IP and per account where relevant).
- Read the user's status and profile from the database on each protected request, not from the JWT.

## Stock changes (most important rule)
Use one atomic conditional update inside a Mongo transaction, and write the movement in the same transaction:
```js
// delta < 0 (ship / decrement) must not go below zero
const filter = { _id, isArchived: false, ...(delta < 0 && { quantity: { $gte: -delta } }) };
const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: delta } }, { new: true, session });
if (!product) throw new AppError(400, 'INSUFFICIENT_STOCK', '...');
await StockMovement.create([{ product: _id, type, quantityChange: delta,
  quantityBefore: product.quantity - delta, quantityAfter: product.quantity,
  performedBy: user._id, performedByName: user.name, supplier, note }], { session });
```
"Adjust" computes the delta from the requested absolute quantity inside the transaction.

## Seed data (every feature)
Every feature that adds or changes a model also updates the seed in the same change:
- Data lives in `server/seed/data/*.js` (plain objects); `server/seed/seed.js` inserts it. Run with `npm run seed -w server` (adds what is missing) or `npm run seed:reset -w server` (wipe and reseed). Never runs in production.
- Seed data must obey the PRD rules: product stock comes only from replayed movement history, receives record the product's supplier, performers are active, profile-complete users.
- Cover the edge cases the UI must show (each role/status, each stock status, archived, inactive or unused records, empty states).
- Extend `server/tests/seed/seed.test.js` so the new data is checked against the rules.

## Testing
- Vitest or Jest + supertest + mongodb-memory-server started as a replica set.
- Test the happy path, validation errors, each role/status gate, and concurrency for stock changes.
- In `NODE_ENV=test`, the `x-test-user` header may be used to simulate an authenticated user. This hook must not exist in production builds.

## Env
All variables are listed in `docs/PRD.md` section 9 and mirrored in `server/.env.example`.
With no SMTP configured in development, `mail.service` logs emails (and their links) instead of sending. Production fails fast without SMTP settings.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `FatemehYafteh/Inventory-App`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Building tickets

Tickets are built one at a time with `/mattpocock-skills:implement #<issue>`, each in a fresh session (`/clear` between tickets), until every ticket is done. There is no code review per ticket. After the last ticket, one fresh session runs `/mattpocock-skills:code-review` over all the changes. Don't change this workflow, and don't skip a ticket unless it is genuinely blocked.

`scripts/implement-all.sh [--base <ref>] [<issue>...]` runs this unattended: one `claude -p` session per issue, then one review session. With no issues given, it takes every open issue without a `(#<issue>)` commit on the branch, in number order. It needs a clean tree on a feature branch. A ticket whose session ends with `BLOCKED: <reason>` and changes nothing is skipped; any other failure stops the run. Logs and the review report go to `logs/tickets/<timestamp>/`.

When implementing a ticket in this flow:
- Implement only that ticket's scope.
- Skip the implement skill's code-review step.
- If the ticket is genuinely blocked, change nothing and end the reply with `BLOCKED: <reason>`.
- Run `npm run lint` and `npm test` before committing.
- Make one commit per ticket on the current branch, titled `feat: <issue title> (#<issue>)`.
- Don't push, open a PR, or close the issue. Issues close when the milestone PR merges.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
