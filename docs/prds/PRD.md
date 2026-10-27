# Product Requirements Document: Product Inventory Manager

**Version:** 1.5 (MVP)
**Date:** 2026-10-14

**Changes in 1.5:** Telegram edge cases settled (details in sub-PRD 03): `rate_limited` request status, with OTP sends counted over 1 hour; Confirm link counts toward the login lock and is rate limited; no link and no email for rejected accounts; per-address limit on Complete-profile emails; Connect Telegram checks who owns a Telegram ID only after the code is verified; Profile page open to pending users; the webhook uses `APP_URL` (no separate API URL); the seeded Telegram admin has a verified email.
**Changes in 1.4:** Telegram sign-in clarified (see sub-PRD 03 and `GLOSSARY.md`): OTP resend endpoint and rate-limit numbers; `refused` status for rejected Telegram users; "Connect Telegram" (`purpose = connect`) named apart from "Account link"; Connect Telegram absorbs a Placeholder user; link-confirmation email valid 24 h and also verifies the existing account's email; Complete profile always offers "use a different email"; development works without a bot token.
**Changes in 1.3:** One person = one account (Telegram and email identities merge into one user); Telegram signups must complete a profile (name + verified email); linking Telegram from an email account; password reset by email only, with resend; email sent through Nodemailer over SMTP (Brevo to be configured later); OTP policy 6 digits / 2 min / 3 tries / 60 s resend.
**Changes in 1.2:** Email + password login next to Telegram OTP; user statuses `pending` / `active` / `rejected` with admin approval; every stock movement stores the user who made it.
**Changes in 1.1:** TanStack Query/Table, React Hook Form + Zod; staff permissions clarified; Suppliers added; Telegram-bot OTP with JWT cookies.

## 1. Overview

A web app for tracking products, categories, suppliers and stock levels. Users can browse and search products, adjust stock inline or through receive/ship/adjust actions, and see a full audit trail of every quantity change. Users sign in with a one-time code delivered by a Telegram bot or with email + password. Every person has exactly one account, and an admin approves new accounts.

### Goals
- Give staff a fast way to see what is in stock and change quantities.
- Keep an accurate, auditable history of every stock change.
- Surface low-stock products before they run out.
- Two sign-in methods (Telegram OTP, email + password) that lead to the same single account.
- Every stock change traceable to the person who made it.

### Non-goals (MVP)
- Multi-warehouse or location tracking
- Purchase orders, sales orders
- Barcode scanning, image uploads
- Native mobile app
- Social logins other than Telegram, 2FA on email login
- Changing the account email after it is verified (admin-assisted for now)

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Client | React (Vite), Tailwind CSS, shadcn/ui, React Router |
| Server state | TanStack Query (fetching, caching, mutations, optimistic updates) |
| HTTP client | Axios (one instance; a response interceptor handles errors and refresh-and-retry) |
| Tables | TanStack Table (headless; sorting, pagination and filters are server-driven via manual mode), rendered with shadcn Table |
| Forms | React Hook Form with `@hookform/resolvers/zod` |
| Validation | Zod. Schemas live in a shared package or folder used by both client and server so rules are defined once |
| Server | Node.js, Express |
| Database | MongoDB with Mongoose (replica set required for transactions) |
| Bot | Telegram Bot API via grammY (or node-telegram-bot-api) |
| Auth | JWT access + refresh tokens in httpOnly cookies; Argon2id (or bcrypt) password hashing |
| Email | Nodemailer with an SMTP transport. Brevo SMTP is the intended provider and will be configured later through environment variables; no provider-specific code |

## 3. Users and Roles

Anyone can sign up (Telegram OTP or email + password). A new account has the **staff** role and the **pending** status, and cannot use the app until it has a verified email and an admin has approved it. Admins are created through configuration (see 5.1) and can approve, reject, promote or reactivate users.

**One person, one account.** A user record can hold both sign-in identities (a Telegram account and an email + password). Telegram ID and email are each unique across all users, so a second account for the same person cannot exist. Collisions are resolved by linking, never by creating a duplicate (see 5.1C).

**User statuses**
| Status | Meaning | Can sign in | Can use the app |
|---|---|---|---|
| `pending` | Signed up, waiting for an admin (default) | Yes | No, only the profile and "Awaiting approval" screens; API returns 403 `ACCOUNT_PENDING` |
| `active` | Approved | Yes | Yes, per role |
| `rejected` | Refused or removed by an admin | No | No |

Allowed transitions (admin only): pending to active, pending to rejected, active to rejected, rejected to active or pending. Every change records who made it, when, and an optional reason.

**Access gates, in order:** authenticated, then profile complete (name + verified email, otherwise 403 `PROFILE_INCOMPLETE`), then status (`pending` gives 403 `ACCOUNT_PENDING`, `rejected` is refused), then role.

| Capability | Admin | Staff |
|---|---|---|
| View products, categories, suppliers, movements, dashboard (active users only) | Yes | Yes |
| Create and edit products | Yes | Yes |
| Receive / ship / adjust stock, inline +/- | Yes | Yes |
| View stock history | Yes | Yes |
| Archive / restore products | Yes | **No** |
| Create / edit / delete categories | Yes | No |
| Create / edit / delete suppliers | Yes | No |
| Manage users (approve, reject, reactivate, change role) | Yes | No |
| Export CSV | Yes | Yes |

Server-side checks are the source of truth; hiding buttons in the UI is only a convenience.

## 4. Data Models

### User
- `name` (required once the profile is complete; prefilled from Telegram for Telegram signups)
- `email` (unique sparse, lowercase), `emailVerified` (default false), `pendingEmail` (email entered but not yet verified)
- `passwordHash` (Argon2id; empty until a password is set, for example by a Telegram user through the reset-password email)
- `telegramId` (unique sparse), `telegramUsername`
- At least one sign-in identity exists: `telegramId`, or `email` + `passwordHash`.
- Profile is **complete** when `name` is set and `emailVerified` is true.
- `role`: `admin` | `staff` (default `staff`)
- `status`: `pending` | `active` | `rejected` (default `pending`)
- `statusChangedBy` (ref User), `statusChangedAt`, `statusReason`
- `failedLoginCount`, `lockedUntil`, `lastLoginAt`, timestamps
- Users are never hard-deleted once they have history. The only deletion is the placeholder user removed in an account link (see 5.1C), which by construction has no history.

### EmailToken (short-lived, TTL index)
- `user`, `type`: `verify_email` | `reset_password` | `link_telegram`
- `email` (the address the token was sent to), `targetUser` (for `link_telegram`: the existing account that would receive the Telegram identity)
- `tokenHash` (random 32 bytes, stored hashed), `expiresAt` (verify 24 h, reset 30 min, link 24 h), `usedAt`
- Issuing a new token of the same type for the same user invalidates the previous one.

### AuthRequest (short-lived, TTL index)
- `requestId`: random opaque value, unique (the browser's only handle on the request)
- `purpose`: `login` | `connect` (`connect` is used when a logged-in user connects Telegram, with `connectUser`)
- `startTokenHash` (unique), `status`: `pending` | `otp_sent` | `verified` | `refused` | `rate_limited` | `expired`
- `telegramId`, `telegramUsername` (may be empty), `name` (filled when the bot receives /start)
- `otpHash`, `otpExpiresAt`, `attempts`, `lastSentAt`, `sendCount`
- `ip`, `userAgent`, `expiresAt` (10 min, the request stops working); the document is auto-deleted 1 hour after creation so OTP sends can be counted per Telegram ID

### RefreshToken
- `user`, `familyId`, `tokenHash`, `expiresAt`, `revokedAt`, `replacedBy`, `ip`, `userAgent`, `createdAt`
- TTL index on `expiresAt`.

### Category
- `title` (required, unique), `description`, timestamps
- Virtual: `productCount`

### Supplier
- `name` (required, unique), `contactPerson`
- `phone`, `email`
- `address`, `notes`
- `isActive` (default true), timestamps
- Virtual: `productCount`

### Product
- `title` (required)
- `sku` (required, unique, uppercase)
- `description`
- `category` (ref Category, required)
- `supplier` (ref Supplier, optional): one supplier per product
- `price` (number >= 0, required)
- `quantity` (integer >= 0, default 0)
- `reorderLevel` (integer >= 0, default 0)
- `isArchived` (default false), `archivedAt`
- `createdAt`, `updatedAt`

**Derived stock status:**
- `out_of_stock`: quantity = 0
- `low_stock`: 0 < quantity <= reorderLevel
- `in_stock`: quantity > reorderLevel

### StockMovement
- `product` (ref Product, required)
- `type`: `receive` | `ship` | `adjust` | `increment` | `decrement`
- `quantityChange` (signed integer), `quantityBefore`, `quantityAfter`
- `supplier` (ref Supplier, optional): snapshot of the product's supplier at the time of a `receive`
- `note` (optional)
- `performedBy` (ref User, **required**): the authenticated user who made the change, taken from the access token on the server, never from the request body. Applies to every movement type, including inline +/- clicks and the initial stock on product creation.
- `performedByName` (string snapshot of the user's name at that time, kept for readable history)
- `createdAt` (immutable; movements are never edited or deleted)
- Index: `performedBy + createdAt`.

## 5. Functional Requirements

### 5.1 Authentication

Two sign-in methods that end in the same cookie-based session (see Sessions) and the same access gates (section 3).

#### A. Telegram OTP

Login and signup are the same flow. If the Telegram ID already belongs to a user, they are logged in to that user. Otherwise a new user is created with the Telegram ID, name prefilled from Telegram, role `staff`, status `pending`, and an incomplete profile.

**Flow**
1. User opens the login page and clicks **Continue with Telegram**. Client calls `POST /auth/telegram/start`.
2. Server creates an `AuthRequest`, and returns `{ requestId, deepLink }` where `deepLink` is `https://t.me/<BOT_USERNAME>?start=<startToken>`. The start token is random (32 bytes), stored hashed, single use, valid 10 minutes.
3. User opens the link and presses Start in Telegram. The bot receives `/start <startToken>`, finds the pending request, stores the user's Telegram ID, username and name on it, generates the OTP and sends it in the chat. Status becomes `otp_sent`.
4. The login page polls `GET /auth/telegram/status?requestId=` every 2 seconds (stops on expiry) and, once `otp_sent`, shows the OTP input.
5. User enters the OTP. Client calls `POST /auth/telegram/verify` with `{ requestId, otp }`.
6. On success the server finds or creates the user, issues tokens, and **sets them as cookies in the response `Set-Cookie` headers**. The response body contains only the user profile and status, never the tokens.
7. Client routes by the access gates: incomplete profile goes to **Complete profile**, `pending` goes to **Awaiting approval**, `active` goes to the dashboard. `rejected` users get no tokens and see a generic "access denied" message.

**OTP policy**
- 6 digits, generated with a cryptographically secure RNG, stored hashed, single use.
- Expires in 2 minutes. Login: after a wrong code the page starts again with a new 5-minute link; the 3 wrong attempts count across those links per Telegram ID, and the 3rd ends the flow until the first request would have expired (details in sub-PRD 03). Connect: 3 wrong attempts invalidate that code (the user must request a new one).
- Resend (`POST /auth/telegram/resend`) allowed 60 seconds after the last send (the bot sends a new code and the old one is invalidated). Login keeps the attempt count and offers no resend after 3 wrong attempts; connect also allows it after 3 wrong attempts and resets the count. Resending does not extend the 10-minute request. The UI shows a countdown for expiry and for the resend button.
- Rate limits: per IP on `/start`, `/verify`, `/resend` and `/status`, and at most 5 OTP sends per hour per Telegram ID (numbers in sub-PRD 03). Over the per-Telegram-ID limit no OTP is sent, the request becomes `rate_limited`, and the page says to try again in an hour.
- Rejected users are refused with a generic message and no OTP is sent; the request becomes `refused` and the page shows the generic refusal.

#### B. Email + password

**Sign up:** form (React Hook Form + Zod) with name, email, password, confirm password.
1. `POST /auth/register` creates a user with role `staff`, status `pending`, `emailVerified = false`, and sends a verification email. The response is always the same generic message, whether or not the email already exists (prevents account enumeration).
2. The email contains a link with a one-time token (24 h). `POST /auth/verify-email` marks `emailVerified = true`.
3. Until the email is verified the user cannot log in. After verification the account is still `pending` until an admin approves it.

**Login:** `POST /auth/login` with email and password.
- Requires verified email and a password match; then the status rules apply (`pending` gets the awaiting-approval screen, `rejected` is refused).
- Generic error for any failure ("Invalid email or password"), with constant-time comparison even for unknown emails.
- 5 consecutive failures lock the account for 15 minutes; rate limits per IP and per email.
- Success sets the same cookies as Telegram OTP.

**Password rules:** at least 10 characters, validated by a shared Zod schema, checked against a common-password list; hashed with Argon2id (or bcrypt, cost 12).

#### C. Profile completion and one-account linking

**Complete profile (Telegram signups).** Until the profile is complete, the user can only call `GET /auth/me`, `POST /auth/profile/complete`, `POST /auth/profile/resend-verification`, `POST /auth/refresh`, `POST /auth/logout`; everything else returns 403 `PROFILE_INCOMPLETE`.
1. The **Complete profile** screen asks for name (prefilled from Telegram, editable) and email. Client calls `POST /auth/profile/complete`.
2. The server saves the name, stores the email as `pendingEmail`, and emails a verification link (24 h, one-time). The response is the same generic message in every case.
3. The screen then shows "Check your email" with a **Resend** button (60 second cooldown, with countdown), **Use a different email**, and the line "Nothing arriving? Use a different email, or contact an admin." Submitting a different email replaces `pendingEmail` and invalidates the earlier links.
4. **Case 1, email is not used by any user:** clicking the link sets `email`, `emailVerified = true`, and the profile is complete. The account is now visible to admins in the Pending queue.
5. **Case 2, email already belongs to another user (an email + password account, verified or not, not rejected):** the email sent to that address is a **link confirmation** (24 h, one-time) instead. It names the Telegram account that wants to link (display name and username) and says to ignore the message if this was not the owner's request. Clicking opens **Confirm link**, which requires the existing account's **password**. On success:
   - the Telegram ID and username move to the existing account, which keeps its role, status and history, and its email becomes verified;
   - the placeholder user created by the Telegram signup is deleted (it has no history because it could not use the app) and its sessions are revoked;
   - Confirm does not sign anyone in; the person logs in normally afterwards, with either method, and always lands in the same account.
   The password step stops someone who only knows another person's email address from taking over that account just by getting the link clicked. Wrong passwords count toward that account's login lock, and the endpoint is rate limited.
6. **Case 3, email belongs to a user who already has a different Telegram account linked:** no link is made. The email owner is told in the email, and the Telegram signup stays incomplete with the message to use another email or contact an admin.
7. **Email belongs to a rejected user:** no link and no email; the Placeholder user sees the same generic screen. Complete-profile emails are limited per target address (sub-PRD 03).

**Connect Telegram later (email accounts).** On the Profile page a logged-in user can click **Connect Telegram**, which runs the same deep-link + OTP flow with `purpose = connect`. On success the Telegram ID is attached to the current user. If that Telegram ID belongs to a Placeholder user (a Telegram signup with no verified email), that user is absorbed in one transaction: the Telegram ID moves over and the Placeholder user is deleted with its sessions. If it belongs to any other user, the request is refused with 409 and a message to contact an admin. Disconnecting is not supported in the MVP.

#### D. Password reset (email only)

Password reset works only through email. There is no reset through Telegram.
1. **Forgot password** page: user enters their email and submits `POST /auth/forgot-password`. The response is always the same generic message.
2. If the account exists, has a verified email, and is not `rejected`, a reset link is emailed (30 minutes, single use). Requesting a new link invalidates the previous one.
3. **Resend:** the page shows a Resend button with a 60 second cooldown and countdown; limit of 5 reset emails per hour per email address and per IP.
4. **Reset password** page (`POST /auth/reset-password` with token and new password): on success all of the user's refresh tokens are revoked, a confirmation email is sent, and the user must log in again. The user is not logged in automatically.
5. A user who signed up through Telegram and has no password yet can use the same flow to **set** a first password, which also enables email login on their account.
6. Reset emails are only sent to a verified email address.

#### E. Email delivery

- A `mail.service` wraps **Nodemailer** with an SMTP transport configured entirely from environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). Brevo's SMTP relay is the intended provider and will be set up later; nothing in the code depends on it, so swapping providers is a config change.
- When SMTP is not configured (local development), emails are written to the server log with their links instead of being sent. Production startup fails fast if SMTP settings are missing.
- Templates: verify email, link confirmation, reset password, password changed confirmation, account approved, account rejected.
- Sending is retried a few times on transient failures; failures never reveal to the caller whether an account exists.
- For deliverability, the sender domain should be verified with the provider (SPF and DKIM) before launch.

**Notifications:** when an admin approves or rejects an account, the user is told by email and, if they have a Telegram chat with the bot, by a bot message.

#### Sessions (both methods)

**Cookies**
| Cookie | Lifetime | Path | Flags |
|---|---|---|---|
| `access_token` | 15 minutes | `/` | `HttpOnly; Secure; SameSite=Strict` |
| `refresh_token` | 7 days | `/api/auth` | `HttpOnly; Secure; SameSite=Strict` |

- `Secure` is always on in production (HTTPS). For local development over plain HTTP it is controlled by an environment flag.
- Tokens are never exposed to JavaScript and never stored in localStorage.
- Client and API are served from the same site (for example behind one reverse proxy or sibling subdomains) so `SameSite=Strict` works.
- CSRF defence: SameSite=Strict, `Origin` header check on all state-changing requests, and a required custom header (`X-Requested-With`) on the API.
- A user may be signed in on several devices at once; each device has its own refresh token family.

**Refresh and logout**
- `POST /auth/refresh` reads the refresh cookie, validates it, and issues a new access and refresh token. The old refresh token is revoked (rotation).
- If a revoked refresh token is presented again (reuse), the whole token family is revoked and the user must log in again.
- The client's API layer (TanStack Query + an Axios instance whose response interceptor handles errors and refresh) retries a failed request once after a 401 by calling refresh, and redirects to login if refresh fails.
- `POST /auth/logout` revokes the refresh token and clears both cookies.

**Access enforcement**
- Middleware order on protected routes: authenticate, load user, check profile, check status, check role.
- Profile and status are read from the database on each request (or a short cache), not trusted from the JWT, so approval, rejection and reactivation take effect immediately.
- Incomplete-profile users are limited to the endpoints listed in 5.1C. `pending` users may call only `GET /auth/me`, `PATCH /auth/profile`, the Connect Telegram endpoints, `POST /auth/logout`, `POST /auth/refresh`; everything else returns 403 `ACCOUNT_PENDING`.
- Rejecting a user revokes all their refresh tokens.

**Admin bootstrap**
- `ADMIN_TELEGRAM_IDS` and `ADMIN_EMAILS` (comma-separated env vars). A user matching either becomes `admin` with status `active` once their profile is complete (verified email).
- Admins manage everyone else from the Users page (approve, reject, reactivate, change role).

**Telegram bot**
- Runs inside the API process when `TELEGRAM_BOT_TOKEN` is set. Development: long polling. Production: webhook at `POST /api/telegram/webhook`, verified with Telegram's secret token header, registered by the server on startup. Selected by environment (`BOT_MODE=polling|webhook`).
- Development without a bot token: the server logs start tokens and OTPs, and a script stands in for pressing Start (sub-PRD 03).
- The bot only handles `/start <token>`. For anything else it replies with brief help text. The bot never sends data other than OTP and short status messages.

**Note on open signup:** anyone can create an account, but nothing is usable until the email is verified and an admin approves it. Remaining risks (spam signups, email abuse) are handled by rate limits, email verification and the ability to reject.

### 5.2 Products Page

**Header:** page title, "Add Product" button, search input.

**Search:** matches title and SKU, debounced 300 ms.

**Filters:**
- Category (single select)
- Supplier (single select)
- Stock status (All / In stock / Low stock / Out of stock)
- "Show archived" toggle (default off; shown to admins only, since staff cannot restore)
- Search, filters, sort and page are kept in the URL query string.

**Table (TanStack Table, manual server-side mode):** Title (SKU underneath), Category, Supplier, Price, Quantity (inline controls), Stock status badge, Created date, Actions.

**Sorting:** click header to sort by Title, Quantity or Price; asc/desc toggle; server-side.

**Pagination:** server-side, default 20 per page, selectable page size.

**Inline quantity:** `-` and `+` buttons beside the quantity.
- Each click records a `decrement` or `increment` movement of 1.
- `-` disabled at 0.
- Optimistic update via TanStack Query mutation with rollback on error; the server applies a delta, never an absolute value.
- Rapid clicks are queued so each request is correct.

**Row actions:**
1. **Edit** (admin and staff): sheet/modal form with React Hook Form + Zod. Fields: title, SKU, description, category, supplier, price, reorder level. Quantity is changed only through stock actions.
2. **Archive / Restore** (admin only): confirm dialog. The action is not rendered for staff and the API returns 403 if called.
3. **Stock history** (admin and staff): modal with that product's movements (date, type, change, before, after, supplier, note, **performed by**), newest first, paginated.
4. **Adjust stock** (admin and staff): modal with three modes:
   - **Receive**: add quantity (> 0); the movement records the product's supplier.
   - **Ship**: remove quantity (> 0, <= current).
   - **Adjust**: set a new absolute quantity; the system records the difference. Same-as-current is rejected.
   - Optional note. Shows current and resulting quantity before submit.

**Add Product:** sheet/modal form. Optional initial quantity creates a `receive` movement noted "Initial stock".

### 5.3 Categories Page
- Responsive grid of cards: title, description, product count.
- "Add Category" (admin), Edit (admin), Delete (admin).
- Delete is blocked with a clear message if the category has any products (including archived).
- Staff see cards read-only.
- Clicking a card opens Products filtered by that category.

### 5.4 Suppliers Page
- TanStack Table with columns: Name, Contact person, Phone, Email, Product count, Actions.
- Search by name, contact person, phone or email; sort by name; server-side pagination.
- Admin: add, edit, deactivate/reactivate, delete. Delete is blocked if any product or any stock movement references the supplier (the error reports both counts and suggests deactivating instead). Deactivated suppliers cannot be chosen for new products but remain on existing ones.
- Staff: read-only.
- Row link: view products from that supplier (Products page filtered by supplier).
- Form fields: name (required), contact person, phone, email (valid format), address, notes.

### 5.5 Stock Movements Page
- Table of all movements: date, product (title + SKU), type, change, before, after, supplier, note, **performed by** (user name, with role badge).
- Filters: product (searchable select), type, supplier, **user (performed by)**, date range.
- Newest first; server-side pagination; CSV export of the filtered result.

### 5.6 Dashboard
- Summary cards: active products, total units, inventory value (price x quantity), low-stock count, out-of-stock count.
- Low-stock list (lowest quantity-to-reorder ratio first) with a quick "Receive" action.
- Recent movements (last 10).
- Admins also see a "Pending approvals" card.

### 5.7 Users Page (admin)
- Tabs: **Pending** (with count badge in the navigation), **Active**, **Rejected**. Only users with a completed profile (verified email) appear in Pending; unfinished signups are listed under a separate "Incomplete profile" filter.
- Table: name, email (with verified indicator), Telegram username, sign-in methods, role, status, signed up, last login.
- Actions: Approve, Reject (optional reason), Reactivate (rejected to active or pending), Change role.
- An admin cannot reject or demote themselves, and the last active admin cannot be removed.
- Each user's detail drawer shows the status change history and a link to their stock movements.

### 5.8 Screens for incomplete and pending users
- **Complete profile:** name and email form, "Check your email" state with Resend and countdown, Use a different email, Log out. Polls `GET /auth/me` and moves to Awaiting approval once the email is verified.
- **Awaiting approval:** short message, name and sign-in methods, Refresh button, Log out. Polls `GET /auth/me` periodically so the app opens as soon as the user is approved.
- **Confirm link:** opened from the link-confirmation email; asks for the existing account's password; shows success (with a Log in button, no automatic sign-in) or an error.

### 5.9 Profile Page (pending and active users)
- Pending users reach it from Awaiting approval, in a minimal layout without app navigation.
- Edit name.
- Shows connected sign-in methods: email (verified) and Telegram (connected or not), with **Connect Telegram** when missing.
- Password changes happen only through the reset-by-email flow (a "Send password reset email" button).

### 5.10 CSV Export
- Products (respects search and filters) and Movements (respects filters). Values starting with `=`, `+`, `-`, `@` are escaped to prevent spreadsheet formula injection.

## 6. API Specification

All routes under `/api`, JSON, authenticated via the access cookie unless marked public.

**Auth**
- `POST /auth/telegram/start` (public)
- `GET /auth/telegram/status` (public, requires requestId)
- `POST /auth/telegram/resend` (public for login, authenticated for connect; requires requestId)
- `POST /auth/telegram/verify` (public)
- `POST /auth/telegram/connect/start`, `POST /auth/telegram/connect/verify` (authenticated; connect Telegram to the current user)
- `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification` (public)
- `POST /auth/login` (public)
- `POST /auth/forgot-password`, `POST /auth/reset-password` (public; forgot-password also serves resend)
- `POST /auth/profile/complete`, `POST /auth/profile/resend-verification` (authenticated, incomplete profile)
- `POST /auth/link-telegram/confirm` `{ token, password }` (public; completes a Telegram-to-email-account link)
- `PATCH /auth/profile` `{ name }`
- `POST /auth/refresh` (refresh cookie)
- `POST /auth/logout`
- `GET /auth/me`
- `POST /telegram/webhook` (production only, secret-token verified)

**Users (admin)**
- `GET /users?status=&search=&incomplete=&page=&limit=`
- `PATCH /users/:id/status` `{ status, reason }`
- `PATCH /users/:id/role` `{ role }`
- `GET /users/pending-count`

**Categories**
- `GET /categories`
- `POST`, `PATCH /:id`, `DELETE /:id` (admin; delete returns 409 if products exist)

**Suppliers**
- `GET /suppliers?search=&active=&sortBy=&order=&page=&limit=`
- `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id` (admin; 409 `IN_USE` if products or stock movements reference it)

**Products**
- `GET /products?search=&category=&supplier=&status=&archived=&sortBy=&order=&page=&limit=`
- `POST /products`, `GET /products/:id`, `PATCH /products/:id` (admin, staff)
- `PATCH /products/:id/archive` and `/restore` (**admin only**)
- `POST /products/:id/stock`: `{ type, quantity, note }` (admin, staff)
- `GET /products/:id/movements`
- `GET /products/export`

**Movements**
- `GET /movements?product=&type=&supplier=&user=&from=&to=&page=&limit=` (each row includes `performedBy { id, name, role }`)
- `GET /movements/export`

**Dashboard**
- `GET /dashboard`

**Conventions:** error shape `{ message, code?, errors? }`; list shape `{ data, page, limit, total }`; Zod validation middleware on every write endpoint; shared Zod schemas reused by client forms. Defined error codes include `PROFILE_INCOMPLETE` and `ACCOUNT_PENDING`.

## 7. Business Rules and Edge Cases

- Quantity never goes below 0; the server rejects with 400.
- Stock changes use an atomic conditional update (`$inc` with a quantity guard) and write the movement in the same MongoDB transaction, so quantity and history cannot diverge or oversell.
- `quantityBefore` / `quantityAfter` captured at write time.
- SKU unique and case-insensitive.
- Archived products cannot receive stock changes until restored.
- A `receive` movement stores the supplier the product had at that moment, so later supplier changes do not rewrite history.
- A category cannot be deleted while products (archived included) reference it. A supplier cannot be deleted while products or stock movements reference it; deactivate it instead.
- Status changes take effect immediately: rejecting revokes refresh tokens, and every request re-checks the current profile and status.
- `performedBy` is always set server-side from the authenticated user; a request that tries to send it is ignored. A stock write without an authenticated, `active`, profile-complete user is impossible.
- Email addresses are trimmed and lowercased before storage and lookup. `email` and `telegramId` are unique across users, so one person cannot end up with two accounts.
- An account link (5.1C case 2) runs in one transaction: attach the Telegram identity to the existing user, delete the placeholder user, revoke the placeholder's tokens. If any step fails nothing changes.
- A link or verification token is single use, expires, and is invalidated when a newer token of the same type is issued.
- Price stored as a number with 2 decimals.

## 8. Non-Functional Requirements

- **Performance:** product list under 300 ms at 10,000 products. Indexes on `sku`, `category`, `supplier`, `title`, `quantity`, `price`, `isArchived`; movements on `product + createdAt`, `type`, `supplier`, `performedBy + createdAt`; users on `email`, `telegramId`, `status`.
- **Security:** hashed OTPs, refresh tokens, start tokens and email tokens; helmet; rate limiting; strict CORS (same-site); input validation and sanitization; no secrets in the client; bot token, JWT secrets and SMTP credentials in environment variables.
- **Accessibility:** keyboard-navigable tables, dialogs and OTP input; labels; stock status not conveyed by color alone.
- **Responsive:** usable on tablet and mobile.
- **Quality:** ESLint/Prettier; unit tests for stock service, OTP, token rotation and account linking; API integration tests for auth, gates and role checks; basic component tests for forms.

## 9. Environment Variables

`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECURE`, `CLIENT_ORIGIN`, `APP_URL` (used in email links), `TRUST_PROXY` (proxies in front of the API, default 0), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_MODE`, `ADMIN_TELEGRAM_IDS`, `ADMIN_EMAILS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `BREVO_API_KEY` (Brevo HTTPS API instead of SMTP, for hosts that block SMTP)

## 10. Suggested Structure

```
shared/schemas          (Zod: product, category, supplier, stock, auth, profile)
client/src
  components/ui         (shadcn)
  components/products   (ProductTable, ProductFilters, StockAdjustDialog, StockHistoryDialog, ProductForm)
  components/categories (CategoryCard, CategoryForm)
  components/suppliers  (SupplierTable, SupplierForm)
  components/data-table (reusable TanStack Table wrapper: header sort, pagination, toolbar)
  pages                 (Login, Register, VerifyEmail, ForgotPassword, ResetPassword, CompleteProfile,
                         ConfirmLink, AwaitingApproval, Profile, Dashboard, Products, Categories,
                         Suppliers, Movements, Users)
  lib                   (api client with refresh retry, queryClient, auth context and route guards)
  hooks                 (useProducts, useCategories, useSuppliers, useMovements, useStockMutation)
server/src
  models, controllers, routes
  middleware (auth, requireProfile, requireActive, requireRole, validate, rateLimit, csrf, error)
  services (stock.service, auth.service, otp.service, token.service, password.service,
            mail.service, account-link.service, user-status.service)
  bot (telegram bot, start handler)
```

## 11. Milestones

1. **Foundation:** repo, Express + Mongo, shared Zod package, layout shell
2. **Auth core:** email register/verify/login, cookies, refresh rotation, mail service (console fallback), forgot/reset password with resend
3. **Telegram and identity:** bot, start/OTP/verify, Complete profile, account linking, Connect Telegram, Profile page
4. **Roles and approval:** access gates, user statuses, Users page, pending queue and notifications
5. **Categories and Suppliers:** API + pages
6. **Products:** API, TanStack table, search, filters, sort, pagination, create/edit
7. **Stock engine:** atomic stock service, inline +/-, adjust modal, history modal with performed-by
8. **Movements page and dashboard**
9. **Archive/restore (admin), CSV export, SMTP (Brevo) setup, polish, tests**

## 12. Acceptance Criteria (highlights)

- A new Telegram user can open the deep link, receive an OTP and verify it; they are asked for name and email, and cannot use the app until the email is verified.
- OTP expires after 2 minutes, locks after 3 wrong tries, and can be resent only after 60 seconds.
- Entering a new email on the Complete profile screen sends a verification link; after clicking it the account appears in the admin Pending queue and the user sees the awaiting-approval screen.
- Entering an email that belongs to an email + password account sends a link-confirmation email; the link works only with that account's password, then the Telegram identity is attached to the existing account and no duplicate user remains. Entering an email already linked to another Telegram account does not link anything.
- An email user can connect Telegram from the Profile page; a Telegram ID that already belongs to another user is refused.
- Responses to verify, login and refresh set `access_token` and `refresh_token` via `Set-Cookie` with `HttpOnly` and, in production, `Secure`; tokens never appear in the response body or JavaScript-readable storage.
- Expired, reused or over-attempted OTPs and start tokens are rejected; reuse of a rotated refresh token revokes the session family.
- A new email user must verify their email before logging in and is `pending` until approved.
- Wrong email or password, unknown email and locked accounts give the same generic response; forgot-password never reveals whether an email exists.
- Password reset works only through an emailed link (30 minutes, single use); resend is available after 60 seconds and capped at 5 per hour; a successful reset revokes all existing sessions; a Telegram-created user can use it to set a first password.
- With no SMTP configured in development, emails appear in the server log; in production the server refuses to start without SMTP settings.
- `pending` users get 403 `ACCOUNT_PENDING` and incomplete profiles get 403 `PROFILE_INCOMPLETE` on every data endpoint; `rejected` users cannot log in and their sessions end immediately; approval takes effect without re-login.
- Only admins can change status or role; the last active admin cannot be removed.
- Staff can edit products and adjust stock but get no archive action in the UI and 403 from the archive endpoint.
- Each stock action creates exactly one movement with correct before/after values and `performedBy` set to the acting user; it is visible in the product history modal and the Movements page, and filterable by user. Receives record the product's supplier.
- Shipping more than available is blocked.
- Stock status filter and badges follow each product's reorder level.
- A category with products cannot be deleted. A supplier with products or stock movements cannot be deleted.
- Sorting by title, quantity and price covers the whole dataset, not only the current page.
- Forms validate with the same Zod schemas on client and server.

## 13. Open Questions / Future Work

- Changing the account email after verification
- Disconnecting Telegram from an account
- Optional 2FA (Telegram OTP) on email login
- Limiting each user to one active session (currently multiple devices are allowed)
- Multiple suppliers per product (currently one)
- Currency and tax handling
- Multiple warehouses
- Low-stock notifications through the Telegram bot
- Product images and barcode scanning
