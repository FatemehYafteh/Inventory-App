# Sub-PRD 04: Roles, Access Gates and User Approval

**Parent:** [PRD.md](PRD.md) sections 3, 5.1 Access enforcement, 5.1 Admin bootstrap, 5.1E Notifications, 5.7, 5.8 (Awaiting approval)
**Milestone:** 4
**Depends on:** 02, 03

## 1. Goal

Nobody uses the app until they have a verified email and an admin has approved them. Admins manage user status and roles, and every protected request enforces profile, status and role from the database.

## 2. Scope

### In scope
- Middleware: `authenticate`, `requireProfile`, `requireActive`, `requireRole`.
- `user-status.service`: transitions, audit fields, token revocation, notifications.
- Admin bootstrap from env vars.
- Users page (admin), pending-count badge, Awaiting approval screen.
- Client route guards that mirror the gates.
- Approval/rejection notifications by email and Telegram bot.

### Out of scope
- Domain pages (05 onward) except the role matrix they must respect.

## 3. Roles and statuses

| Status | Meaning | Can sign in | Can use the app |
|---|---|---|---|
| `pending` | Waiting for admin (default) | Yes | No: only profile and Awaiting approval; API 403 `ACCOUNT_PENDING` |
| `active` | Approved | Yes | Yes, per role |
| `rejected` | Refused or removed | No | No |

**Transitions (admin only):** pending to active, pending to rejected, active to rejected, rejected to active or pending. Each records `statusChangedBy`, `statusChangedAt`, optional `statusReason`.

**Role matrix** (enforced server-side; later slices must apply it):

| Capability | Admin | Staff |
|---|---|---|
| View products, categories, suppliers, movements, dashboard | Yes | Yes |
| Create / edit products | Yes | Yes |
| Receive / ship / adjust, inline +/- | Yes | Yes |
| View stock history | Yes | Yes |
| Archive / restore products | Yes | **No** |
| Create / edit / delete categories | Yes | No |
| Create / edit / delete suppliers | Yes | No |
| Manage users | Yes | No |
| Export CSV | Yes | Yes |

## 4. Functional requirements

### 4.1 Access gates
Order on every protected route: **authenticate, load user, profile complete, status, role.**
- Profile and status are read from the database on each request (or a short cache), never from the JWT, so changes take effect without re-login.
- Incomplete profile: only the endpoints listed in 03 section 4.3; else 403 `PROFILE_INCOMPLETE`.
- `pending`: only `GET /auth/me`, `PATCH /auth/profile`, Telegram link endpoints, `POST /auth/logout`, `POST /auth/refresh`; else 403 `ACCOUNT_PENDING`.
- `rejected`: refused at login/OTP verify and on every request.
- Role failure: 403.

### 4.2 Admin bootstrap
- `ADMIN_TELEGRAM_IDS` and `ADMIN_EMAILS` (comma-separated). A matching user becomes `admin` + `active` once their profile is complete (verified email), and the promotion is recorded as a status change made by the system. It happens once, when the profile becomes complete or Telegram is connected, and only for a `pending` user: an admin's later decision (rejected, demoted) is never overridden, and there is no startup sweep.

### 4.3 Status changes
- Rejecting a user revokes all their refresh tokens immediately.
- On approve or reject, the user is notified by email (templates from 02) and, if they have a Telegram chat with the bot, by a bot message.
- An admin cannot reject or demote themselves. The last active admin cannot be removed (rejected or demoted).

### 4.4 Users page (admin)
- Tabs: **Pending** (count badge in navigation), **Active**, **Rejected**. Pending shows only completed profiles; unfinished signups are under an "Incomplete profile" filter.
- Table: name, email (verified indicator), Telegram username, sign-in methods, role, status, signed up, last login.
- Actions: Approve, Reject (optional reason), Reactivate (to active or pending), Change role.
- Detail drawer: status-change history and a link to the user's stock movements (Movements page filtered by user, 08).

### 4.5 Awaiting approval screen
- Short message, name, sign-in methods, Refresh button, Log out.
- Polls `GET /auth/me` periodically and opens the app as soon as the user is approved.

### 4.6 Client guards
- Route guards redirect by gate: incomplete to Complete profile, pending to Awaiting approval, active to the requested page. Admin-only routes are hidden and guarded for staff.

## 5. API (admin)

| Method | Path | Body / query |
|---|---|---|
| GET | `/users` | `status, search, incomplete, page, limit` |
| PATCH | `/users/:id/status` | `{ status, reason }` |
| PATCH | `/users/:id/role` | `{ role }` |
| GET | `/users/pending-count` | |

## 6. Acceptance criteria
- `pending` users get 403 `ACCOUNT_PENDING` and incomplete profiles get 403 `PROFILE_INCOMPLETE` on every data endpoint.
- `rejected` users cannot log in, and their existing sessions end immediately.
- Approval takes effect without re-login (Awaiting approval screen opens the app on its next poll).
- Only admins can change status or role; an admin cannot reject or demote themselves; the last active admin cannot be removed.
- Bootstrap admins become `admin` / `active` after verifying their email.
- Integration tests cover each gate, each transition, and the role checks.
