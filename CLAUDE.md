# Server rules (Node.js, Express, Mongoose)

Applies in addition to the root `CLAUDE.md`. Requirements: `docs/PRD.md` sections 3, 4, 5, 6, 7.

## Structure
```
server/src/
  app.js              builds the Express app and registers every router
  index.js            starts the server and (optionally) the Telegram bot
  config/             env validation (fail fast), cookie and CORS config
  models/             Mongoose models (User, AuthRequest, EmailToken, RefreshToken, Category, Supplier, Product, StockMovement)
  routes/             route definitions only (path, middleware, controller)
  controllers/        thin: parse request, call a service, send response
  services/           ALL business logic (stock, auth, otp, token, password, mail, account-link, user-status)
  middleware/         auth, requireProfile, requireActive, requireRole, validate, rateLimit, csrf, error
  bot/                Telegram bot and /start handler
  utils/
tests/                mirrors src/, supertest + mongodb-memory-server (replica set)
```

## Conventions
- ES modules, async/await, no callbacks. Controllers never touch models directly for business rules; they call services.
- Every write endpoint uses the `validate` middleware with a Zod schema from `shared/schemas`.
- One error class (`AppError(status, code, message)`) and one error-handler middleware. Never leak stack traces or internal details.
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

## Testing
- Vitest or Jest + supertest + mongodb-memory-server started as a replica set.
- Test the happy path, validation errors, each role/status gate, and concurrency for stock changes.
- In `NODE_ENV=test`, the `x-test-user` header may be used to simulate an authenticated user. This hook must not exist in production builds.

## Env
All variables are listed in `docs/PRD.md` section 9 and mirrored in `server/.env.example`.
With no SMTP configured in development, `mail.service` logs emails (and their links) instead of sending. Production fails fast without SMTP settings.
