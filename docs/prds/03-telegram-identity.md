# Sub-PRD 03: Telegram Login and Identity Linking

**Parent:** [PRD.md](PRD.md) sections 4 (AuthRequest), 5.1A, 5.1C, 5.1 Telegram bot, 5.8 (Complete profile, Confirm link), 5.9
**Milestone:** 3
**Depends on:** 01, 02
**Terms:** see [GLOSSARY.md](../../GLOSSARY.md) (User, Placeholder user, Complete profile, Connect Telegram, Account link, One-time code).

## 1. Goal

Users can sign in with a one-time code from the Telegram bot. Telegram signups must complete their profile with a verified email. One person always ends up with exactly one account, whichever sign-in method they use.

## 2. Scope

### In scope
- Telegram bot (`/start <token>` handler, polling or webhook), with a development fallback when no bot token is set.
- Telegram OTP login/signup flow, OTP policy and resend.
- Complete profile flow, including the three email-collision cases.
- Account link (a Placeholder user's Telegram identity moved into an existing account).
- Connect Telegram from the Profile page (`purpose = connect`).
- Pages: Login and Register (Telegram part), CompleteProfile, ConfirmLink, Profile.

### Out of scope
- Disconnecting Telegram, changing a verified email (future).
- Enforcing the `PROFILE_INCOMPLETE` gate on data endpoints (04 owns the gate middleware; this slice defines which endpoints are allowed).
- Admin bootstrap from `ADMIN_TELEGRAM_IDS` / `ADMIN_EMAILS` (04).
- Automatic cleanup of abandoned Placeholder users.

## 3. Data model: AuthRequest (TTL index)
- `requestId`: random opaque value (not a Mongo ObjectId), unique; the only handle the browser holds
- `purpose`: `login` | `connect`; `connectUser` (for `connect`)
- `startTokenHash` (unique), `status`: `pending` | `otp_sent` | `verified` | `refused` | `expired`
- `telegramId`, `telegramUsername` (may be empty), `name` (filled on `/start`)
- `otpHash`, `otpExpiresAt`, `attempts`, `lastSentAt`
- `ip`, `userAgent`, `expiresAt` (10 min, auto-deleted)

A **Placeholder user** is a User created by a Telegram sign-in with no verified email. It has only a Telegram identity, cannot use the app and has no history. It stays until its email is verified (case 1), or it is deleted by an Account link (case 2) or absorbed by Connect Telegram (4.4).

## 4. Functional requirements

### 4.1 Telegram OTP login / signup
Login and signup are the same flow, offered on both the Login and Register pages (**Continue with Telegram** above the email form, with an "or" divider). Known Telegram ID: log in to that user. Unknown: create a Placeholder user with the Telegram ID, name prefilled from Telegram, `staff`, `pending`.

1. **Continue with Telegram**: `POST /auth/telegram/start`.
2. Server creates an AuthRequest and returns `{ requestId, deepLink }`, `deepLink = https://t.me/<BOT_USERNAME>?start=<startToken>`. Start token: 32 random bytes, stored hashed, single use, 10 min.
3. The page shows an **Open Telegram** button and, on wide screens, a QR code of the same link (for people with Telegram only on their phone).
4. Bot receives `/start <startToken>`, finds the pending request, stores Telegram ID, username and name, generates and sends the OTP. Status `otp_sent`. If the Telegram ID belongs to a `rejected` user: no OTP, status `refused`, and the bot replies with the generic refusal.
5. Login page polls `GET /auth/telegram/status?requestId=` every 2 s (stops on expiry, `refused` or `verified`). On `otp_sent` it shows the OTP input and "We sent a code to @username in Telegram" (display name when there is no username), with countdowns for expiry and resend. On `refused` it shows the same generic "Access denied, contact an admin" as email login.
6. `POST /auth/telegram/verify` `{ requestId, otp }`.
7. On success: find or create the user, refresh `telegramUsername` (never `name`), set session cookies (as in 02). Body contains only profile and status.
8. Client routes: incomplete profile to **Complete profile**, `pending` to **Awaiting approval**, `active` to dashboard. `rejected`: no tokens, generic "access denied".

### 4.2 OTP policy
- 6 digits, crypto-secure RNG, stored hashed, single use.
- Expires in 2 minutes. 3 wrong attempts invalidate the code; the page shows "Too many wrong codes" with the resend countdown.
- Resend: `POST /auth/telegram/resend { requestId }` (login and connect), allowed 60 s after the last send, including after 3 wrong attempts. New code, old one invalid, attempts reset. Resending does not extend the 10-minute request.
- Bot message: "Your sign-in code is 123456. It expires in 2 minutes. Only enter it on <APP_URL>. Never share it with anyone."
- Rate limits:
  | What | Limit |
  |---|---|
  | `POST /telegram/start`, `/telegram/connect/start` | 20 per hour per IP |
  | `POST /telegram/verify`, `/telegram/connect/verify` | 30 per 15 min per IP |
  | `POST /telegram/resend` | 20 per hour per IP |
  | `GET /telegram/status` | 300 per 15 min per IP (polling) |
  | OTP sends (first + resends) | 5 per hour per Telegram ID |
- Rejected users get a generic refusal and no OTP.

### 4.3 Complete profile (Telegram signups)
While incomplete, the user may only call `GET /auth/me`, `POST /auth/profile/complete`, `POST /auth/profile/resend-verification`, `POST /auth/refresh`, `POST /auth/logout`. Everything else: 403 `PROFILE_INCOMPLETE`.

1. Screen asks for name (prefilled, editable) and email. `POST /auth/profile/complete`.
2. Server saves the name, stores email as `pendingEmail`, emails a link (24 h, single use). Same generic response in every case. Submitting again with a different email replaces `pendingEmail` and invalidates every unused verify and link-confirmation token from earlier submissions.
3. Screen shows "Check your email" with Resend (60 s cooldown + countdown), **Use a different email**, and Log out. It always also says "Nothing arriving? Use a different email, or contact an admin." (the only hint case 3 gets, so the response stays generic).
4. **Case 1, email unused:** clicking the link sets `email`, `emailVerified = true`; profile complete; the user now appears in the admin Pending queue (04). If another user took that email in the meantime, the link fails with the normal "invalid or expired" message.
5. **Case 2, email belongs to an email + password account (verified or not):** that address receives a **link confirmation** email (24 h, single use) naming the Telegram account (display name, plus username when there is one) and saying to ignore it if not requested. The link opens **Confirm link**, which requires the existing account's **password** (`POST /auth/link-telegram/confirm { token, password }`). On success, in **one transaction**:
   - Telegram ID and username move to the existing account (keeps role, status, history);
   - the existing account's email becomes verified (clicking the link proved it);
   - the Placeholder user is deleted and its sessions revoked;
   - if any step fails, nothing changes.
   Confirm does not sign anyone in. The page says "Telegram is now connected to your account. Log in with Telegram or your email." with a Log in button. The Placeholder user's open tabs go back to Login without an error.
   The password step stops someone who only knows another person's email from taking over that account.
6. **Case 3, email belongs to a user with a different Telegram account:** no link. The email owner is told by email; the Telegram signup stays incomplete and the screen from step 3 offers another email.

### 4.4 Connect Telegram (email accounts)
- Profile page **Connect Telegram** runs the same deep-link + OTP flow with `purpose = connect` via `POST /auth/telegram/connect/start` and `POST /auth/telegram/connect/verify` (status and resend are shared with login).
- Success attaches the Telegram ID to the current user.
- If the Telegram ID belongs to a **Placeholder user**, it is absorbed in one transaction: the Telegram ID moves to the current user, the Placeholder user is deleted and its sessions revoked. The OTP already proved the person owns that Telegram account.
- If the Telegram ID belongs to any other user: 409 with "contact an admin".

### 4.5 Profile page (all signed-in users)
- Edit name (`PATCH /auth/profile { name }`).
- Shows sign-in methods: email (verified) and Telegram (connected or not), with **Connect Telegram** when missing.
- Password changes only via "Send password reset email" (02 flow).

### 4.6 Telegram bot
- Runs inside the API process, started from `index.js` only when `TELEGRAM_BOT_TOKEN` is set.
- `BOT_MODE=polling` in development. In production `webhook` at `POST /api/telegram/webhook`, verified with Telegram's secret-token header (`TELEGRAM_WEBHOOK_SECRET`); the server registers the webhook at `APP_URL/api/telegram/webhook` on startup and logs an error if that fails. Production fails fast without `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`.
- **Development without a token:** like `mail.service`, the server logs the start token and every OTP instead of using Telegram, and `npm run tg:start -w server -- <startToken> <telegramId> "<name>" [username]` stands in for pressing Start.
- Handles only `/start <token>`:
  - expired, used or unknown token: "This sign-in link has expired. Go back to the sign-in page and start again."
  - no token or any other message: "To sign in, open the sign-in page and press Continue with Telegram."
- Sends only OTPs and short status messages (approval/rejection messages are triggered by 04).

## 5. API

| Method | Path | Access |
|---|---|---|
| POST | `/auth/telegram/start` | public |
| GET | `/auth/telegram/status?requestId=` | public |
| POST | `/auth/telegram/resend` | public (login) or authenticated (connect) |
| POST | `/auth/telegram/verify` | public |
| POST | `/auth/telegram/connect/start` | authenticated |
| POST | `/auth/telegram/connect/verify` | authenticated |
| POST | `/auth/profile/complete` | authenticated, incomplete profile |
| POST | `/auth/profile/resend-verification` | authenticated, incomplete profile |
| POST | `/auth/link-telegram/confirm` | public |
| PATCH | `/auth/profile` | authenticated |
| POST | `/telegram/webhook` | production, secret-token verified |

## 6. Business rules
- `email` and `telegramId` are unique across users; collisions are resolved by an Account link or by Connect Telegram absorbing a Placeholder user, never by a duplicate account.
- Start tokens, OTPs and email tokens are hashed, single use, expiring.
- Account link and Placeholder absorption are all-or-nothing in one Mongo transaction.

## 7. Seed data
- No AuthRequests (they expire after 10 minutes).
- Users added: a Placeholder user awaiting email verification (`pendingEmail` set), a rejected Telegram user, an active Telegram-only admin. The existing `telegramOnly` user stays as the Placeholder user that has not entered an email.
- `seed.test.js` checks every Placeholder user has no history and every `telegramId` is unique.

## 8. Acceptance criteria
- A new Telegram user opens the deep link, receives an OTP, verifies it, is asked for name and email, and cannot use the app until the email is verified.
- OTP expires after 2 min, locks after 3 wrong tries, resend only after 60 s; at most 5 OTP sends per hour per Telegram ID.
- Expired, reused or over-attempted OTPs and start tokens are rejected.
- A rejected Telegram user gets no OTP and sees the generic refusal.
- A new email on Complete profile sends a verification link; after clicking it the user sees Awaiting approval and appears in the Pending queue.
- An email belonging to an email + password account sends a link confirmation; it works only with that account's password; afterwards no duplicate user remains and the email is verified.
- An email already linked to another Telegram account links nothing, and the user can enter another email.
- An email user can connect Telegram from Profile; a Placeholder user holding that Telegram ID is absorbed; a Telegram ID owned by any other user is refused with 409.
- Development works with no bot token (logged OTPs and the `tg:start` script).
- Unit tests: OTP generation/attempts/expiry/resend, Account link and Placeholder absorption (including rollback on failure).
