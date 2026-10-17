# M4 implementation plan: roles, access gates and user approval

Inputs: `docs/prds/04-roles-approval.md`, PRD 3, 5.1, 5.7, 5.8, `tasks/task.md` (M4), `GLOSSARY.md` (Roles and approval), issues #9 to #13.
Interview settled on 2026-10-17 (questions Q1 to Q14, all recommendations accepted).

This plan has four separate parts: **1 Decisions** (settled with the owner), **2 Assumptions** (taken as true; what breaks if wrong), **3 Changes** (scope, behavior, edge cases, data, API), **4 Unknowns** (open, with who resolves them).

---

## 1. Decisions

| # | Decision |
|---|---|
| Q1 | One composed chain `protect(...roles)` = authenticate, requireProfile, requireActive, requireRole. Every M5+ data route uses it. Proven by a probe route mounted only in tests. The `/auth` routes that pending users may call simply do not use `requireActive`. |
| Q2 | New `StatusChange` collection (user, from, to, changedBy, changedByName, reason, at), written in the same transaction as the status update. Needs the model list in `server/CLAUDE.md` updated. |
| Q3 | Admin bootstrap runs once, when a profile becomes complete. Promotes only a `pending` user. Never overrides a later admin decision. No startup sweep. |
| Q4 | Approve and reject notify by email (reason included when given) and by bot message to users with a `telegramId` (no reason). Reactivate to `active` counts as approval; reactivate to `pending` sends nothing. A failed send is logged and never blocks or rolls back the change. |
| Q5 | Approve and Reactivate-to-active are refused for incomplete profiles (409 `PROFILE_INCOMPLETE`). Reject is allowed for anyone. |
| Q6 | "Last active admin" = `role=admin` and `status=active`. A change leaving zero is refused (409), checked atomically. A rejected admin keeps the `admin` role. Nobody can reject or demote themselves, even with other admins around. |
| Q7 | Awaiting approval polls `GET /auth/me` every 10 s and stops once active. The pending-count badge refreshes every 30 s and after any status change made on the Users page. |
| Q8 | The central client request interceptor handles 403 `ACCOUNT_REJECTED` (clear session, go to login with a generic "Access denied") and 403 `ACCOUNT_PENDING` / `PROFILE_INCOMPLETE` (refresh `/auth/me`, the guards route). |
| Q9 | Role change only for `active` users (409 otherwise). Takes effect on the next request. No session ending, no notification. |
| Q10 | `GET /users`: search name, email, Telegram username (case-insensitive, regex-escaped). Pending sorts oldest signup first; Active and Rejected by name. Page 20, max 100. Response `{ items, total, page, limit }`, each item with `hasPassword` and `hasTelegram`. Tab counts come from a separate call. |
| Q11 | Disallowed transition (including to the same status) is 409 `INVALID_TRANSITION`. The update is conditional on the current status, so concurrent clicks resolve to one winner. `reason` is optional, trimmed, max 500, stored on the `StatusChange`; `User.statusReason` mirrors the latest and is only returned to admins. |
| Q12 | Staff who open an admin-only page are redirected to the dashboard. The nav link is hidden. The API is the real gate (403). |
| Q13 | The drawer's Movements link is a disabled button ("Available once Movements ships") until M8, which enables it with `/movements?user=<id>`. |
| Q14 | Seed adds about 30 generated staff users in mixed statuses with replayed `StatusChange` history that ends at each user's current status. |

---

## 2. Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | `authenticate` already loads the user from the database and refuses `rejected` with 403 `ACCOUNT_REJECTED` on every request (`server/src/middleware/auth.js`). Rejecting therefore needs no access-token revocation, only refresh-token revocation. | Add `sessionsRevokedAt` on reject. |
| A2 | Every user that can reach a status change has a name or is a Placeholder user; `isProfileComplete` (name + verified email) is the only completeness test. | Users page filters would misclassify users. |
| A3 | Admin-list matching is on the verified `email` (lowercased, trimmed) or the stored `telegramId` string, as `config.admins` already parses them. | Bootstrap would miss or mis-match admins. |
| A4 | The bootstrap promotion is itself recorded as a `StatusChange` with `changedBy: null`, `changedByName: "System (admin list)"`. | Drawer would show a status with no history row. |
| A5 | `GET /auth/me` already returns `role`, `status` and `profileComplete` (the client guards rely on them). To confirm in task 1. | Add the fields. |
| A6 | `lastLoginAt` is set on email and Telegram login (seen in `auth.service.js` and `telegramAuth.service.js`). | "Last login" column would be empty. |
| A7 | A Telegram private chat id equals `telegramId`, so a bot message can be sent to it. A blocked bot makes the send fail, which is only logged. | Users who blocked the bot get no message. |
| A8 | `pending-count` counts only pending users with a complete profile (same as the Pending tab). | Badge would count users nobody can approve. |
| A9 | Existing M3 gates stay as they are: `requireIncompleteProfile` on Complete profile endpoints, `requireProfile` on `PATCH /auth/profile`. | n/a |

---

## 3. Changes

### 3.1 Data model

`User` (existing): no new fields. `role`, `status`, `statusChangedBy`, `statusChangedAt`, `statusReason`, `lastLoginAt` already exist. Add an index `{ status: 1, createdAt: 1 }` for the Pending queue and `{ role: 1, status: 1 }` for the last-admin count.

`StatusChange` (new, `server/src/models/StatusChange.js`):

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId ref User | required, indexed with `at` desc |
| `from` | enum status | required (`pending` for the first change from signup) |
| `to` | enum status | required |
| `changedBy` | ObjectId ref User | null for system / bootstrap |
| `changedByName` | String | name at the time |
| `reason` | String, max 500, trimmed | optional |
| `at` | Date | default now |

Add it to the model list in `server/CLAUDE.md`. Offer an ADR for "history in its own collection" only if the owner thinks it is hard to reverse; this plan treats it as not meeting the bar.

### 3.2 Server

**Middleware** (`server/src/middleware/`)
- `requireActive`: `pending` gives 403 `ACCOUNT_PENDING` (message "Your account is waiting for approval."). `rejected` is already refused by `authenticate`.
- `requireRole(...roles)`: 403 `FORBIDDEN` when `req.user.role` is not listed.
- `protect(config, ...roles)` in `server/src/middleware/protect.js`: `[authenticate(config), requireProfile, requireActive, ...(roles.length ? [requireRole(...roles)] : [])]`. Order is fixed: authenticate, profile, status, role.

**Services** (`server/src/services/`)
- `userStatus.service.js`
  - `TRANSITIONS`: pending to active or rejected; active to rejected; rejected to active or pending.
  - `changeStatus({ actor, userId, to, reason }, deps)`, in one Mongo transaction:
    1. Load target; 404 if missing.
    2. Same status or not in `TRANSITIONS`: 409 `INVALID_TRANSITION`.
    3. `actor._id` equals target and `to` is `rejected`: 409 `CANNOT_CHANGE_SELF`.
    4. `to` is `active` and profile incomplete: 409 `PROFILE_INCOMPLETE`.
    5. Target is an active admin and `to` is `rejected`: last-active-admin check inside the transaction (count of `{ role: admin, status: active }` excluding the target must be at least 1); else 409 `LAST_ADMIN`.
    6. Conditional update `findOneAndUpdate({ _id, status: from }, { status, statusChangedBy, statusChangedAt, statusReason }, { session })`; null means another admin acted first: 409 `INVALID_TRANSITION`.
    7. Write the `StatusChange` row. On `rejected`: `revokeAllForUser(userId, { session })`.
    8. After commit: notify (below). Notification errors are caught and logged.
  - `changeRole({ actor, userId, role })`: target must be `active` (409 `USER_NOT_ACTIVE`), role differs (409 `INVALID_TRANSITION`), actor is not the target when demoting (409 `CANNOT_CHANGE_SELF`), last-active-admin check on demotion (409 `LAST_ADMIN`), all in one transaction with a conditional update on the current role.
  - `listStatusHistory(userId)`: newest first.
- `userNotify.service.js`: `notifyApproved(user)` and `notifyRejected(user, reason)`. Email through `mailer.sendInBackground` using two new templates `accountApprovedTemplate` and `accountRejectedTemplate` in `mail.templates.js` (HTML-escaped; the rejected one includes the reason only when given). Telegram through `app.locals.telegram` (a short message; never the reason). Skip email if `user.email` is not verified; skip Telegram without `telegramId`.
- `adminBootstrap.service.js`: `applyAdminBootstrap(user, config)`: returns without change unless the profile is complete, `status` is `pending` and the verified email is in `config.admins.emails` or the `telegramId` is in `config.admins.telegramIds`. Otherwise, in one transaction, sets `role=admin`, `status=active`, `statusChangedAt` and writes a `StatusChange` (A4). Idempotent. Called from the four places a profile becomes complete or gains Telegram: email verification (`verify-email`), Account link confirm (`confirmAccountLink`), Connect Telegram (`verifyConnect`), and the Complete profile verify path. Bootstrap admins are not notified.
- `users.service.js`: `listUsers({ status, search, incomplete, page, limit })`, `pendingCount()`, `getUser(id)` (with history).

**Controllers and routes**
- `server/src/controllers/users.controller.js` (thin) and `server/src/routes/users.routes.js`, mounted at `/api/users`, all behind `protect(config, 'admin')`.

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/users` | `status` (pending, active, rejected), `search`, `incomplete` (bool), `page`, `limit` | `{ items, total, page, limit }` |
| GET | `/users/pending-count` | | `{ count }` |
| GET | `/users/:id` | | user plus `history[]` |
| PATCH | `/users/:id/status` | `{ status, reason? }` | updated user |
| PATCH | `/users/:id/role` | `{ role }` | updated user |

Item shape: `id, name, email, emailVerified, telegramUsername, hasPassword, hasTelegram, role, status, profileComplete, createdAt, lastLoginAt`. `statusReason`, `statusChangedAt` and `statusChangedBy` (name) are included for admins only. Never `passwordHash`.
- Define `pending-count` and `/:id` so `pending-count` is matched first.
- Errors use `AppError(status, code, message)`: 400 `VALIDATION_ERROR`, 401 `NOT_AUTHENTICATED`, 403 `PROFILE_INCOMPLETE` / `ACCOUNT_PENDING` / `FORBIDDEN`, 404 `NOT_FOUND`, 409 `INVALID_TRANSITION` / `CANNOT_CHANGE_SELF` / `LAST_ADMIN` / `PROFILE_INCOMPLETE` / `USER_NOT_ACTIVE`.
- Zod schemas in `shared/schemas/users.js`: `listUsersQuery`, `changeStatusSchema`, `changeRoleSchema`, exported from `shared/schemas/index.js`. Write routes use `validate`.
- The Users API is a write API behind the CSRF check, so the client sends `X-Requested-With` as it already does.

### 3.3 Client

- `client/src/lib/api.js`: interceptor handling for `ACCOUNT_REJECTED`, `ACCOUNT_PENDING`, `PROFILE_INCOMPLETE` (Q8). Add a test per code.
- `client/src/lib/users.js`: TanStack Query hooks `useUsers`, `usePendingCount` (30 s), `useUser`, `useChangeStatus`, `useChangeRole`. Status changes invalidate users, pending-count and `me`.
- `AwaitingApprovalPage`: add polling (10 s, stops when `me.status` is `active`), keep the Refresh button. When approved, the guard sends the user to the dashboard.
- `guards.jsx`: add `RequireAdmin` (redirect staff to `/`). Admin-only routes sit under `RequireActive` then `RequireAdmin`.
- `AppLayout`: nav item "Users" for admins with the pending-count badge (hidden at 0).
- `UsersPage` (`/users`): tabs Pending, Active, Rejected; search box; "Incomplete profile" toggle on the Pending tab; table with name, email (verified indicator), Telegram username, sign-in methods, role, status, signed up, last login; pagination. Row actions by status: Pending: Approve (disabled with tooltip for incomplete), Reject. Active: Reject, Change role. Rejected: Reactivate to Active, Reactivate to Pending. Your own row and a last active admin have their destructive actions disabled with an explanation. Reject opens a dialog with an optional reason. Empty, loading and error states for every tab.
- `UserDrawer` (row click): profile summary, sign-in methods, role, status, status history (who, when, from to, reason), and the disabled "View movements" button (Q13).
- Reuse the existing `components/data-table`; put page components in `client/src/components/users/` (it currently holds only a README).

### 3.4 Seed data

- New `server/seed/data/statusChanges.js` and an extended `users.js`; `seed.js` inserts both.
- Keep the existing role/status users. Add about 30 generated staff users: more than 20 Active (second page), a few Pending with complete profiles, one Pending with an incomplete profile, several Rejected (two with reasons), one rejected then reactivated, one with a Telegram-only sign-in. Add a second admin so the last-admin rule is demonstrable, and keep one scenario with exactly one active admin documented in the seed comments.
- Every `StatusChange` is replayed in order and ends at the user's current status; `changedBy` is an active admin; Pending users that came from signup have no history rows.
- Extend `server/tests/seed/seed.test.js`: history ends at current status, performers are active admins, no pending user lacks a complete profile unless intended, at least one user per tab, more than one page of Active users.

### 3.5 Configuration and docs

- `ADMIN_EMAILS` / `ADMIN_TELEGRAM_IDS` already exist in `env.js` and `.env.example`; no new variables.
- Update `server/CLAUDE.md` (models list, middleware list), `tasks/task.md` statuses as tickets land, and sub-PRD 04 sections 4.1 and 4.3 where the decisions above sharpen them (error codes, bootstrap rule, history collection).

### 3.6 Build order (maps to the issues)

1. **#9 Access gates and Awaiting approval:** `requireActive`, `requireRole`, `protect`, probe-route tests, client interceptor, polling, `RequireAdmin`.
2. **#10 Admin bootstrap:** `adminBootstrap.service` wired into the four completion points, `StatusChange` model (first use), seed admin cases.
3. **#11 Status and role changes:** `userStatus.service`, notification templates, the Users API, seed history.
4. **#12 Users page:** page, tabs, actions, nav badge.
5. **#13 Drawer:** `GET /users/:id` with history, drawer, disabled movements button.

#10 creates the `StatusChange` model that #11 builds on; if #10 is built first the model lives there. The order #9, #10, #11, #12, #13 respects every dependency.

### 3.7 Edge cases and tests (each is an integration test unless noted)

- Gates: incomplete profile gives `PROFILE_INCOMPLETE` on the probe route; pending gives `ACCOUNT_PENDING`; rejected gives `ACCOUNT_REJECTED`; staff gets 403 on an admin route; the `/auth` pending allow-list still works for pending users; approval takes effect without re-login.
- Transitions: every allowed move; every disallowed move (active to pending, same status, pending to pending); approve with incomplete profile; reject with incomplete profile succeeds.
- Concurrency: two admins approve the same user, one wins, the other gets 409; two admins demote each other at once, at most one succeeds; the last active admin cannot be rejected or demoted in any interleaving.
- Self: reject or demote yourself gives `CANNOT_CHANGE_SELF` even with other admins.
- Rejection: refresh tokens are revoked; the next request returns `ACCOUNT_REJECTED`; login is refused; a reactivated user logs in again.
- Role: only active users; same role refused; demotion applies on the next request.
- Notifications: approve and reject send email and bot message to a user with both; email-only and Telegram-only users; reason in email but not in the bot message; reactivate to pending sends nothing; a thrown send error does not fail or roll back the change.
- Bootstrap: email match, Telegram match, unverified email, no match, already active, already rejected (not re-promoted), already demoted (not re-promoted), runs at each of the four completion points, history row written.
- Users API: list by tab, search, incomplete filter, pagination bounds (limit above 100 is rejected), sort order per tab, `hasPassword`/`hasTelegram`, no `passwordHash`, pending-count excludes incomplete profiles, 400 on bad query.
- Client: interceptor per code, polling starts and stops, guards for each gate, `RequireAdmin`, Users page tabs/filters/actions/empty/error states, disabled actions with tooltips, drawer content and order, badge visibility.
- Seed: see 3.4.

### 3.8 Out of scope

Domain pages (M5 onward), the Movements page itself, role-change notifications, a user-chosen sort on the Users page, deleting users, email-change by admins.

---

## 4. Unknowns

| # | Unknown | Resolved by |
|---|---|---|
| U1 | Wording of the approved and rejected email and bot texts. Plan assumes plain, short copy in the style of existing templates. | Owner reviews in #11. |
| U2 | Whether `GET /auth/me` returns `role`, `status`, `profileComplete` today (A5). | Check at the start of #9; add if missing. |
| U3 | Whether Complete profile verification and Account link call a common function where bootstrap can hook in, or four separate places (3.2). | Read the code at the start of #10. |
| U4 | Whether the Users page needs a per-tab count in the tab labels (only Pending is polled today). | Owner, during #12; default is badge on Pending only. |
| U5 | Whether a Rejected user who is a Placeholder (Telegram-only, no email) can appear in the list with no email; row display for it. | Check seed and render in #12; default shows "No email". |
| U6 | An ADR for the `StatusChange` collection. The plan does not require one. | Owner, optional. |
| U7 | Behavior when a bootstrap admin's env entry is removed later: they keep the admin role (the list only seeds). | Confirm with owner if this surprises them; documented in the glossary entry. |
