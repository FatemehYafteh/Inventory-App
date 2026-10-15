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
- `startTokenHash` (unique), `status`: `pending` | `otp_sent` | `verified` | `refused` | `rate_limited` | `locked` | `expired`
- `telegramId`, `telegramUsername` (may be empty), `name` (filled on `/start`)
- `otpHash`, `otpExpiresAt`, `attempts`, `lastSentAt`, `sendCount`
- `ip`, `userAgent`, `expiresAt` (10 min, or 5 min when started again after a wrong code: the request stops working)
- `triesUntil` (login): until when the wrong tries count across new links (4.2)
- The document itself is deleted by the TTL index 1 hour after creation, so the per-Telegram-ID send limit (4.2) can be counted by summing `sendCount` over that Telegram ID's requests from the last hour.

A **Placeholder user** is a User created by a Telegram sign-in with no verified email. It has only a Telegram identity, cannot use the app and has no history. It stays until its email is verified (case 1), or it is deleted by an Account link (case 2) or absorbed by Connect Telegram (4.4).

## 4. Functional requirements

### 4.1 Telegram OTP login / signup
Login and signup are the same flow, offered on both the Login and Register pages (two tabs, **Email** first and **Telegram**; both stay mounted, so switching keeps what was typed and a Telegram request in progress; **Continue with Telegram** is in the Telegram tab). Known Telegram ID: log in to that user. Unknown: create a Placeholder user with the Telegram ID, name prefilled from Telegram, `staff`, `pending`.

1. **Continue with Telegram**: `POST /auth/telegram/start` (optional body `{ previousRequestId }`, see step 6).
2. Server creates an AuthRequest and returns `{ requestId, deepLink }`, `deepLink = https://t.me/<BOT_USERNAME>?start=<startToken>`. Start token: 32 random bytes, stored hashed, single use, 10 min.
3. The page shows an **Open Telegram** button and, from the `md` breakpoint (≥768 px) up, a QR code of the same link (`qrcode.react`), for people with Telegram only on their phone.
4. Bot receives `/start <startToken>`, finds the pending request, stores Telegram ID, username and name (first name + last name, cut to 100 characters), generates and sends the OTP. Status `otp_sent`. If the Telegram ID belongs to a `rejected` user: no OTP, status `refused`, and the bot replies with the generic refusal. If the Telegram ID has reached the send limit (4.2): no OTP, status `rate_limited`, and the bot replies "Too many codes requested. Try again in an hour." If the Telegram ID has used its 3 wrong tries (4.2): no OTP, status `locked`, and the bot replies "Too many wrong codes. Try again later."
5. Login page polls `GET /auth/telegram/status?requestId=` every 2 s (stops on expiry, `refused`, `rate_limited`, `locked` or `verified`; an unknown `requestId` reads as `expired`). On `otp_sent` it shows the OTP input and "We sent a code to @username in Telegram" (display name when there is no username), with countdowns for expiry and resend. On `refused` it shows the same generic "Access denied, contact an admin" as email login. On `rate_limited` it shows "Too many codes requested. Try again in an hour." On `locked` it shows "Too many wrong codes. Try again later."
6. `POST /auth/telegram/verify` `{ requestId, otp }`. A wrong code shows the tries left ("Wrong code. 2 tries left.") for 1 second; then the page starts again with `POST /auth/telegram/start { previousRequestId }` and shows the new **Open Telegram** link with the same message. The previous request stops working (status `expired`) and the new one lasts 5 minutes. The tries carry over (4.2).
7. On success: find or create the user, set `telegramUsername` to the current Telegram username (cleared if the person removed it; never touches `name`), set session cookies (as in 02). Body contains only profile and status. The password login lock (`lockedUntil`, 02) does not block Telegram login and is left unchanged.
8. Client routes: incomplete profile to **Complete profile**, `pending` to **Awaiting approval**, `active` to dashboard. `rejected`: no tokens, generic "access denied".

### 4.2 OTP policy
- 6 digits, crypto-secure RNG, stored hashed, single use.
- Expires in 2 minutes.
- Login: 3 wrong attempts in all per Telegram ID, counted across the new links started after wrong codes, until the first of those requests would have expired (`triesUntil`; a verified sign-in starts the count over). The 3rd wrong attempt ends the flow: the page shows "Too many wrong codes. Try again later." with no resend, and pressing Start on any new link before `triesUntil` gives status `locked`.
- Connect: 3 wrong attempts invalidate the code; the page shows "Too many wrong codes" with the resend countdown.
- Resend: `POST /auth/telegram/resend { requestId }` (login and connect), allowed 60 s after the last send. New code, old one invalid. Resending does not extend the request. Login: attempts carry on, and no resend after 3 wrong attempts. Connect: also allowed after 3 wrong attempts, and attempts reset.
- Bot message: "Your sign-in code is 123456. It expires in 2 minutes. Only enter it on <APP_URL>. Never share it with anyone." For `connect` requests: "Your code to connect Telegram to your account is 123456. …" (same rest).
- Rate limits:
  | What | Limit |
  |---|---|
  | `POST /telegram/start`, `/telegram/connect/start` | 20 per hour per IP |
  | `POST /telegram/verify`, `/telegram/connect/verify` | 30 per 15 min per IP |
  | `POST /telegram/resend` | 20 per hour per IP |
  | `GET /telegram/status` | 300 per 15 min per IP (polling) |
  | OTP sends (first + resends) | 5 per hour per Telegram ID (a resend over the limit is refused the same way as in 4.1 step 4) |
  | `POST /auth/link-telegram/confirm` | 10 per 15 min per IP |
  | Complete-profile emails (verify, link confirmation, case 3 notice; first + resends) | 5 per hour per target address; beyond that the generic response is returned and nothing is sent |
- Rejected users get a generic refusal and no OTP.

### 4.3 Complete profile (Telegram signups)
While incomplete, the user may only call `GET /auth/me`, `POST /auth/profile/complete`, `POST /auth/profile/resend-verification`, `POST /auth/refresh`, `POST /auth/logout`. Everything else: 403 `PROFILE_INCOMPLETE`.

1. Screen asks for name (prefilled, editable) and email. `POST /auth/profile/complete`.
2. Server saves the name, stores email as `pendingEmail`, emails a link (24 h, single use). Same generic response in every case. Submitting again with a different email replaces `pendingEmail` and invalidates every unused verify and link-confirmation token from earlier submissions.
3. Screen shows "Check your email" with Resend (60 s cooldown + countdown), **Use a different email**, and Log out. It always also says "Nothing arriving? Use a different email, or contact an admin." (the only hint case 3 gets, so the response stays generic). The screen polls `GET /auth/me` every 5 s and moves to Awaiting approval as soon as the email is verified, even when the link was opened on another device.
4. **Case 1, email unused:** the link opens the existing `/verify-email` page; clicking it sets `email`, `emailVerified = true`; profile complete; the user now appears in the admin Pending queue (04). It signs no one in: the page says "Email verified. Return to the app or log in." If another user took that email in the meantime, the link fails with the normal "invalid or expired" message.
5. **Case 2, email belongs to an email + password account (verified or not) that is not `rejected`:** that address receives a **link confirmation** email (24 h, single use) naming the Telegram account (display name, plus username when there is one) and saying to ignore it if not requested. The link opens **Confirm link**, which requires the existing account's **password** (`POST /auth/link-telegram/confirm { token, password }`). On success, in **one transaction**:
   - Telegram ID and username move to the existing account (keeps role, status, history);
   - the existing account's email becomes verified (clicking the link proved it);
   - the Placeholder user is deleted, its sessions revoked and all its email tokens deleted;
   - if any step fails, nothing changes.
   Confirm does not sign anyone in. The page says "Telegram is now connected to your account. Log in with Telegram or your email." with a Log in button. The Placeholder user's open tabs go back to Login without an error.
   The password step stops someone who only knows another person's email from taking over that account. It is protected like email login: a wrong password counts toward the existing account's failed-login lock (02), a locked account is refused, and the token stays usable after a wrong password until it expires.
   Confirm fails with the generic "invalid or expired" message, changing nothing, if since the email was sent the Placeholder user is gone, its `pendingEmail` changed, the existing account gained a Telegram ID, or the existing account was rejected.
6. **Case 3, email belongs to a user with a different Telegram account:** no link. The email owner is told by email; the Telegram signup stays incomplete and the screen from step 3 offers another email.
7. **Email belongs to a `rejected` user:** no link and no email. The Placeholder user sees the same generic "Check your email" screen. A rejected account never gains a sign-in method.

### 4.4 Connect Telegram (email accounts)
- Profile page **Connect Telegram** runs the same deep-link + OTP flow with `purpose = connect` via `POST /auth/telegram/connect/start` and `POST /auth/telegram/connect/verify` (status and resend are shared with login).
- `connect/start` returns 409 `TELEGRAM_ALREADY_CONNECTED` when the current user already has a Telegram ID.
- For `connect` requests, `status` and `resend` require the signed-in user to be the request's `connectUser`.
- Success attaches the Telegram ID to the current user.
- Who owns the Telegram ID is checked only at `connect/verify`, after the code is accepted, so the flow never reveals whether a Telegram ID is registered to someone who has not proved they control it.
- If the Telegram ID belongs to a **Placeholder user**, it is absorbed in one transaction: the Telegram ID moves to the current user, the Placeholder user is deleted, its sessions revoked and all its email tokens deleted. The OTP already proved the person owns that Telegram account.
- If the Telegram ID belongs to any other user: 409 with "contact an admin".

### 4.5 Profile page (`pending` and `active` users)
- Route `/profile`. Active users see it inside the app layout; pending users see it in a minimal layout without app navigation, linked from Awaiting approval ("Edit profile / connect Telegram").
- Edit name (`PATCH /auth/profile { name }`).
- Shows sign-in methods: email (verified) and Telegram (connected or not), with **Connect Telegram** when missing.
- Password changes only via "Send password reset email" (02 flow).

### 4.6 Telegram bot
- Runs inside the API process, started from `index.js` only when `TELEGRAM_BOT_TOKEN` is set.
- `BOT_MODE=polling` in development. In production `webhook` at `POST /api/telegram/webhook`, verified with Telegram's secret-token header (`TELEGRAM_WEBHOOK_SECRET`); the server registers the webhook at `APP_URL/api/telegram/webhook` on startup and logs an error if that fails. This works because client and API are served from one site behind a reverse proxy (PRD 5.1 Sessions); there is no separate API URL setting. Production fails fast without `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`.
- **Development without a token:** like `mail.service`, the server logs the start token and every OTP instead of using Telegram, and `npm run tg:start -w server -- <startToken> <telegramId> "<name>" [username]` stands in for pressing Start.
- Handles only `/start <token>`:
  - expired, used or unknown token: "This sign-in link has expired. Go back to the sign-in page and start again."
  - no token or any other message: "To sign in, open the sign-in page and press Continue with Telegram."
- Sends only OTPs and short status messages (approval/rejection messages are triggered by 04).

## 5. API

| Method | Path | Access |
|---|---|---|
| POST | `/auth/telegram/start` | public |
| GET | `/auth/telegram/status?requestId=` | public (login) or the request's `connectUser` (connect) |
| POST | `/auth/telegram/resend` | public (login) or the request's `connectUser` (connect) |
| POST | `/auth/telegram/verify` | public |
| POST | `/auth/telegram/connect/start` | authenticated |
| POST | `/auth/telegram/connect/verify` | authenticated |
| POST | `/auth/profile/complete` | authenticated, incomplete profile |
| POST | `/auth/profile/resend-verification` | authenticated, incomplete profile |
| POST | `/auth/link-telegram/confirm` | public |
| PATCH | `/auth/profile` | authenticated, complete profile, `pending` or `active` |
| POST | `/telegram/webhook` | production, secret-token verified |

## 6. Business rules
- `email` and `telegramId` are unique across users; collisions are resolved by an Account link or by Connect Telegram absorbing a Placeholder user, never by a duplicate account.
- Start tokens, OTPs and email tokens are hashed, single use, expiring.
- Account link and Placeholder absorption are all-or-nothing in one Mongo transaction.

## 7. Seed data
- No AuthRequests (they expire after 10 minutes).
- Users added: a Placeholder user awaiting email verification (`pendingEmail` set), a rejected Telegram user, and an active Telegram admin with a verified email and no password (a Telegram-only admin would have an incomplete profile). The existing `telegramOnly` user stays as the Placeholder user that has not entered an email.
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
- A Telegram ID over the send limit gets no OTP and the page shows "Too many codes requested".
- Confirm link counts wrong passwords toward the account lock, is rate limited, and refuses rejected accounts or changed state without changing anything.
- An email belonging to a rejected user links nothing and sends nothing.
- Connect Telegram never reveals another user's Telegram ID before the code is verified; an already-connected user cannot start it.
- Development works with no bot token (logged OTPs and the `tg:start` script).
- Unit tests: OTP generation/attempts/expiry/resend, Account link and Placeholder absorption (including rollback on failure).
