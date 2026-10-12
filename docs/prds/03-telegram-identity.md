# Sub-PRD 03: Telegram Login and Identity Linking

**Parent:** [PRD.md](PRD.md) sections 4 (AuthRequest), 5.1A, 5.1C, 5.1 Telegram bot, 5.8 (Complete profile, Confirm link), 5.9
**Milestone:** 3
**Depends on:** 01, 02

## 1. Goal

Users can sign in with a one-time code from the Telegram bot. Telegram signups must complete their profile with a verified email. One person always ends up with exactly one account, whichever sign-in method they use.

## 2. Scope

### In scope
- Telegram bot (`/start <token>` handler, polling or webhook).
- Telegram OTP login/signup flow and OTP policy.
- Complete profile flow, including the three email-collision cases.
- Confirm link (Telegram identity merged into an existing email account).
- Connect Telegram from the Profile page (`purpose = link`).
- Pages: Login (Telegram part), CompleteProfile, ConfirmLink, Profile.

### Out of scope
- Disconnecting Telegram, changing a verified email (future).
- Enforcing the `PROFILE_INCOMPLETE` gate on data endpoints (04 owns the gate middleware; this slice defines which endpoints are allowed).

## 3. Data model: AuthRequest (TTL index)
- `purpose`: `login` | `link`; `linkUser` (for `link`)
- `startTokenHash` (unique), `status`: `pending` | `otp_sent` | `verified` | `expired`
- `telegramId`, `telegramUsername`, `name` (filled on `/start`)
- `otpHash`, `otpExpiresAt`, `attempts`, `lastSentAt`
- `ip`, `userAgent`, `expiresAt` (10 min, auto-deleted)

## 4. Functional requirements

### 4.1 Telegram OTP login / signup
Login and signup are the same flow. Known Telegram ID: log in to that user. Unknown: create a user with the Telegram ID, name prefilled from Telegram, `staff`, `pending`, incomplete profile.

1. Login page, **Continue with Telegram**: `POST /auth/telegram/start`.
2. Server creates an AuthRequest and returns `{ requestId, deepLink }`, `deepLink = https://t.me/<BOT_USERNAME>?start=<startToken>`. Start token: 32 random bytes, stored hashed, single use, 10 min.
3. Bot receives `/start <startToken>`, finds the pending request, stores Telegram ID, username and name, generates and sends the OTP. Status `otp_sent`.
4. Login page polls `GET /auth/telegram/status?requestId=` every 2 s (stops on expiry); on `otp_sent` shows the OTP input.
5. `POST /auth/telegram/verify` `{ requestId, otp }`.
6. On success: find or create the user, set session cookies (as in 02). Body contains only profile and status.
7. Client routes: incomplete profile to **Complete profile**, `pending` to **Awaiting approval**, `active` to dashboard. `rejected`: no tokens, generic "access denied".

### 4.2 OTP policy
- 6 digits, crypto-secure RNG, stored hashed, single use.
- Expires in 2 minutes. 3 wrong attempts invalidate the code.
- Resend after 60 s cooldown: new code, old one invalid, attempts reset. UI shows countdowns for expiry and resend.
- Rate limits: per IP on `/start` and `/verify`; per Telegram ID on OTP sends.
- Rejected users get a generic refusal and no OTP.

### 4.3 Complete profile (Telegram signups)
While incomplete, the user may only call `GET /auth/me`, `POST /auth/profile/complete`, `POST /auth/profile/resend-verification`, `POST /auth/refresh`, `POST /auth/logout`. Everything else: 403 `PROFILE_INCOMPLETE`.

1. Screen asks for name (prefilled, editable) and email. `POST /auth/profile/complete`.
2. Server saves the name, stores email as `pendingEmail`, emails a link (24 h, single use). Same generic response in every case.
3. Screen shows "Check your email" with Resend (60 s cooldown + countdown) and Log out.
4. **Case 1, email unused:** clicking the link sets `email`, `emailVerified = true`; profile complete; the user now appears in the admin Pending queue (04).
5. **Case 2, email belongs to an email + password account:** that address receives a **link confirmation** email naming the Telegram account (display name + username) and saying to ignore it if not requested. The link opens **Confirm link**, which requires the existing account's **password** (`POST /auth/link-telegram/confirm { token, password }`). On success, in **one transaction**:
   - Telegram ID and username move to the existing account (keeps role, status, history);
   - the placeholder Telegram user is deleted (it has no history) and its sessions revoked;
   - if any step fails, nothing changes.
   The password step stops someone who only knows another person's email from taking over that account.
6. **Case 3, email belongs to a user with a different Telegram account:** no link. The email owner is told by email; the Telegram signup stays incomplete with "use another email or contact an admin".

### 4.4 Connect Telegram (email accounts)
- Profile page **Connect Telegram** runs the same deep-link + OTP flow with `purpose = link` via `POST /auth/telegram/link/start` and `POST /auth/telegram/link/verify`.
- Success attaches the Telegram ID to the current user.
- If the Telegram ID belongs to another user: 409 with "contact an admin".

### 4.5 Profile page (all signed-in users)
- Edit name (`PATCH /auth/profile { name }`).
- Shows sign-in methods: email (verified) and Telegram (connected or not), with **Connect Telegram** when missing.
- Password changes only via "Send password reset email" (02 flow).

### 4.6 Telegram bot
- `BOT_MODE=polling` in development; `webhook` in production at `POST /api/telegram/webhook`, verified with Telegram's secret-token header (`TELEGRAM_WEBHOOK_SECRET`).
- Handles only `/start <token>`; anything else gets brief help text.
- Sends only OTPs and short status messages (approval/rejection messages are triggered by 04).

## 5. API

| Method | Path | Access |
|---|---|---|
| POST | `/auth/telegram/start` | public |
| GET | `/auth/telegram/status?requestId=` | public |
| POST | `/auth/telegram/verify` | public |
| POST | `/auth/telegram/link/start` | authenticated |
| POST | `/auth/telegram/link/verify` | authenticated |
| POST | `/auth/profile/complete` | authenticated, incomplete profile |
| POST | `/auth/profile/resend-verification` | authenticated, incomplete profile |
| POST | `/auth/link-telegram/confirm` | public |
| PATCH | `/auth/profile` | authenticated |
| POST | `/telegram/webhook` | production, secret-token verified |

## 6. Business rules
- `email` and `telegramId` are unique across users; collisions are resolved by linking, never by a duplicate account.
- Start tokens, OTPs and email tokens are hashed, single use, expiring.
- Account link is all-or-nothing in one Mongo transaction.

## 7. Acceptance criteria
- A new Telegram user opens the deep link, receives an OTP, verifies it, is asked for name and email, and cannot use the app until the email is verified.
- OTP expires after 2 min, locks after 3 wrong tries, resend only after 60 s.
- Expired, reused or over-attempted OTPs and start tokens are rejected.
- A new email on Complete profile sends a verification link; after clicking it the user sees Awaiting approval and appears in the Pending queue.
- An email belonging to an email + password account sends a link confirmation; it works only with that account's password; afterwards no duplicate user remains.
- An email already linked to another Telegram account links nothing.
- An email user can connect Telegram from Profile; a Telegram ID owned by another user is refused with 409.
- Unit tests: OTP generation/attempts/expiry, account linking (including rollback on failure).
