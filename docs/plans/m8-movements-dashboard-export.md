# M8 plan: movements, dashboard and CSV export

Status: **awaiting owner approval** (2026-10-21). No application code is changed until approved.
Inputs: sub-PRD 08, PRD 5.5, 5.6, 5.10, 6, `docs/plans/m8-date-range-timezone.md` (Option A), `docs/plans/phase-l-multilingual.md`, `docs/design-system.md`.

## 1. Decisions confirmed by the owner (interview, 2026-10-21)

| # | Decision |
|---|---|
| D1 | **Staff do not see movements of archived products**: not on the Movements page, not in the product filter, not in the CSV, not on the dashboard. Admins see everything. Same rule as the existing per-product history. |
| D2 | **CSV numbers stay raw.** Only text cells (title, SKU, supplier, note, user name) are escaped with a leading apostrophe when they start with `=`, `+`, `-`, `@`. Numeric columns (change, before, after, quantity, price) are written as plain numbers, so `-5` stays a number. |
| D3 | **Exports stream from a database cursor with no row cap.** |
| D4 | **Dashboard low-stock list shows the 10 lowest-ratio products** with a "View all" link to Products filtered by low stock; the card count is the true total. |
| D5 | **Out-of-stock products are in that list too**, first (ratio 0), alongside low stock. The cards still count low stock and out of stock separately. |
| D6 | **Date range = Option A** (already decided): `from`/`to` are full ISO instants, `from` inclusive, `to` exclusive, date-only values rejected. |

## 2. Assumptions (low risk, no input needed; shout if any is wrong)

- A1 The role badge shows the performer's **current** role, looked up from the User record. `performedByName` stays the stored snapshot name. A removed or unknown user shows the name with no badge.
- A2 Movements are newest first only (`createdAt desc, _id desc`). No user-chosen sorting.
- A3 Page size default 20, max 100 (same as the product history). The `user` filter is a user id.
- A4 Dashboard "Recent movements" = last 10, same visibility rule as D1. Inventory value, unit and product counts exclude archived products for everyone.
- A5 Dashboard cards and lists are read in one `GET /dashboard` (aggregations in the database, no loading of all products into memory).
- A6 Pending approvals card is admin-only and uses the existing `/users/pending-count`; staff never request it.
- A7 CSV is UTF-8 with a BOM (so Excel shows Persian text), ISO UTC dates, Latin digits, headers in English, `Content-Disposition` attachment with a dated filename. Persian UI does not change the file (Phase L Q8).
- A8 Exports accept the same filters as their list endpoint and ignore `page`/`limit`. Available to admin and staff; pending/incomplete/rejected get 403 through the existing gate chain.
- A9 Invalid ids or ranges in filters give 400 with catalogue codes from `shared/errorCodes`. A well-formed `product` filter for an archived product returns an empty result for staff (not an error).
- A10 The Receive action on the dashboard reuses `StockAdjustDialog` in Receive mode, then refreshes the dashboard and product queries.
- A11 M8.6: SMTP is already env-configurable and fails fast in production. The work is `.env.example`/docs for Brevo, the final `npm run lint` and `npm test` pass, and a launch checklist. The real delivery and SPF/DKIM check is a **manual step for the owner** and is not marked done by me.
- A12 JavaScript only. New UI uses design-system tokens only (no hard-coded colours), translation keys in `en` and `fa`, logical CSS properties for RTL.

## 3. Work breakdown (one commit per phase, tasks marked Done only when tests pass)

| Phase | Server | Client | Tests |
|---|---|---|---|
| 8.1 | `GET /movements` + `listAllMovements` in `stock.service`; Zod `listAllMovementsQuerySchema` in `shared/schemas/stock.js` (product, type, supplier, user, from, to, page, limit); `performedBy {id, name, role}`; product `{id,title,sku}`; D1 rule; indexes already exist | none | Filters one by one and combined, `to` exclusive, boundary instants, bad ids/dates/ranges, staff vs admin archived, pending/incomplete 403 |
| 8.2 | seed movements covering every type, several performers, supplier/no supplier, archived product | Movements page: table, filters (searchable product, type, supplier, user, date range with Jalali picker), URL-driven state, pagination, loading/empty/error states, `useMovements`; sidebar item; enable the Users drawer link (`/movements?user=<id>`) | Page tests (en and fa), filter-to-URL wiring, drawer link, MSW handlers |
| 8.3 | `GET /dashboard` + `dashboard.service`: cards, low/out-of-stock top 10 by quantity/reorder ratio, last 10 movements | none | Numbers equal the underlying data, ratio ordering, archived excluded, D1 for staff |
| 8.4 | none | Dashboard page: five cards, low-stock list with Receive, recent movements, admin Pending approvals card, states | Page tests (en and fa), staff vs admin |
| 8.5 | `csv.js` util (escape, BOM, streaming), `GET /movements/export`, `GET /products/export` (reuse `filterFor` and the movement filter) | "Export CSV" buttons passing the current filters | `=SUM(A1)` escaped, `-5` raw, exported rows equal page rows, role gates, Persian text |
| 8.6 | Brevo notes in `.env.example`/docs | none | full lint + test pass; checklist for the manual email check |

Seed data and `server/tests/seed/seed.test.js` are extended in the same phases that need them (per CLAUDE.md). `tasks/task.md` rows move to Done only after their tests pass; 8.6 stays partly manual.

## 4. Risks and edge cases to test

- Pagination stability with equal `createdAt` (id tiebreak).
- Cursor export while writes happen: the file is a consistent read of rows at query time, not a snapshot; acceptable for an export.
- Large `user`/`product` filters with the existing indexes (`performedBy + createdAt`, `product + createdAt`).
- Product filter options for staff must not list archived products.
- Formula injection also via the supplier/product names in the products export.
- RTL table with long Persian notes; no horizontal page overflow at 360 px.

## 5. Final report (after all of M8 is done)

Features implemented; files and API changes; tests added; decisions and assumptions; open or manual items (Brevo delivery check); how to verify.
