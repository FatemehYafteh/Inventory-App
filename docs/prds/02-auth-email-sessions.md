# Sub-PRD 02: Email Auth, Sessions and Mail

**Parent:** [PRD.md](PRD.md) sections 4 (User, EmailToken, RefreshToken), 5.1B, 5.1D, 5.1E, 5.1 Sessions
**Milestone:** 2
**Depends on:** 01

## 1. Goal

Users can register with email + password, verify their email, log in, stay signed in with rotating refresh tokens, log out, and reset their password by email. Email is sent through a provider-agnostic mail service.

## 2. Scope

### In scope
- User model (full schema, used by later slices too), EmailToken, RefreshToken.
- Register, verify email, resend verification, login, refresh, logout, `GET /auth/me`.
- Forgot / reset password with resend.
- `mail.service` (Nodemailer SMTP, console fallback in dev) and email templates.
- Cookie session handling and the client API layer's refresh-and-retry.
- Pages: Login (email part), Register, VerifyEmail, ForgotPassword, ResetPassword.

### Out of scope
- Telegram login and linking (03).
- Status / role gates and admin approval (04). In this slice a newly registered user is created `staff` / `pending`; enforcing what `pending` can do comes in 04.

## 3. Data models

### User
- `name`; `email` (unique sparse, lowercase, trimmed); `emailVerified` (default false); `pendingEmail`
- `passwordHash` (Argon2id; empty until set)
- `telegramId` (unique sparse), `telegramUsername` (used in 03)
- At least one sign-in identity: `telegramId`, or `email` + `passwordHash`
- Profile **complete** when `name` is set and `emailVerified` is true
- `role`: `admin` | `staff` (default `staff`); `status`: `pending` | `active` | `rejected` (default `pending`)
- `statusChangedBy`, `statusChangedAt`, `statusReason`
- `failedLoginCount`, `lockedUntil`, `lastLoginAt`, timestamps
- Never hard-deleted once it has history (only exception: placeholder user in 03)
- Indexes: `email`, `telegramId`, `status`

### EmailToken (TTL index)
- `user`, `type`: `verify_email` | `reset_password` | `link_telegram`
- `email`, `targetUser` (for `link_telegram`, used in 03)
- `tokenHash` (random 32 bytes, hashed), `expiresAt` (verify 24 h, reset 30 min, link 24 h), `usedAt`
- Issuing a new token of the same type for the same user invalidates the previous one

### RefreshToken (TTL index on `expiresAt`)
- `user`, `familyId`, `tokenHash`, `expiresAt`, `revokedAt`, `replacedBy`, `ip`, `userAgent`, `createdAt`

## 4. Functional requirements

### 4.1 Register and verify
1. Form: name, email, password, confirm password (React Hook Form + shared Zod).
2. `POST /auth/register` creates a `staff` / `pending` user with `emailVerified = false` and emails a 24 h verification link. **Same generic response whether or not the email exists.**
3. `POST /auth/verify-email` with the token sets `emailVerified = true`. Single use.
4. `POST /auth/resend-verification`: same generic response in every case, rate limited.
5. The user cannot log in until verified. After verification they stay `pending` until approved (04).

### 4.2 Login
- `POST /auth/login` with email + password.
- Requires verified email and password match; then status rules apply (`rejected` refused; `pending` gets a session but only the awaiting-approval screen, see 04).
- Any failure returns "Invalid email or password". Constant-time comparison, including for unknown emails (hash a dummy password).
- 5 consecutive failures lock the account for 15 minutes. Rate limit per IP and per email.
- On success sets `lastLoginAt` and the session cookies.

### 4.3 Password rules
At least 10 characters, shared Zod schema, checked against a common-password list. Argon2id (or bcrypt cost 12).

### 4.4 Password reset (email only)
1. `POST /auth/forgot-password` with email. Always the same generic response. Also serves as resend.
2. If the account exists, has a verified email and is not `rejected`, email a reset link (30 min, single use). A new link invalidates the previous one.
3. Resend button with 60 s cooldown and countdown. Limit 5 reset emails per hour per email and per IP.
4. `POST /auth/reset-password` with token + new password: revokes all the user's refresh tokens, sends a "password changed" email, and does **not** log the user in.
5. A user with no password yet (Telegram signup) can use this flow to set a first password, which enables email login.
6. Reset emails go only to a verified address.

### 4.5 Sessions

| Cookie | Lifetime | Path | Flags |
|---|---|---|---|
| `access_token` | 15 min | `/` | `HttpOnly; Secure; SameSite=Strict` |
| `refresh_token` | 7 days | `/api/auth` | `HttpOnly; Secure; SameSite=Strict` |

- Set only through `Set-Cookie` headers. Never in the response body, never readable by JS, never in localStorage.
- `Secure` always on in production; controlled by `COOKIE_SECURE` for local HTTP.
- Client and API are same-site so `SameSite=Strict` works.
- CSRF: SameSite=Strict + Origin check + required `X-Requested-With` on state-changing requests.
- Multiple devices allowed; each has its own refresh-token family.
- `POST /auth/refresh`: validate refresh cookie, issue new access + refresh, revoke the old one (rotation). **Reuse of a revoked token revokes the whole family.**
- `POST /auth/logout`: revoke the refresh token and clear both cookies.
- Client API wrapper: on 401, call refresh once and retry; if refresh fails, redirect to login.

### 4.6 Mail service
- Nodemailer SMTP transport from `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. Brevo is the intended provider; switching is config only.
- No SMTP in development: log emails and their links to the server log. **Production fails fast without SMTP.**
- Templates: verify email, link confirmation, reset password, password changed, account approved, account rejected (link confirmation is used by 03; approved/rejected by 04).
- Retry a few times on transient failures. Failures never reveal whether an account exists.
- Links use `APP_URL`.

## 5. API

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | public |
| POST | `/auth/verify-email` | public |
| POST | `/auth/resend-verification` | public |
| POST | `/auth/login` | public |
| POST | `/auth/forgot-password` | public |
| POST | `/auth/reset-password` | public |
| POST | `/auth/refresh` | refresh cookie |
| POST | `/auth/logout` | authenticated |
| GET | `/auth/me` | authenticated |

All public routes are rate limited.

## 6. Business rules
- Emails are trimmed and lowercased before storage and lookup.
- Tokens are single use, expire, and are invalidated by a newer token of the same type.
- Refresh tokens, email tokens and passwords are stored hashed.

## 7. Acceptance criteria
- A new email user must verify before logging in and is `pending` afterwards.
- Register, resend and forgot-password give identical responses for existing and unknown emails.
- Wrong password, unknown email and locked account give the same generic login error; 5 failures lock for 15 min.
- Login and refresh set `access_token` and `refresh_token` via `Set-Cookie` with `HttpOnly` (and `Secure` in production); tokens never appear in the body.
- Reusing a rotated refresh token revokes the whole family.
- Reset link is 30 min, single use; resend after 60 s; capped at 5/hour; a reset revokes all sessions and does not log in.
- With no SMTP in development, emails appear in the log; production refuses to start without SMTP.
- Unit tests: token rotation, password hashing. Integration tests: every endpoint above.
