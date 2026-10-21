# Sub-PRD 08: Movements, Dashboard and CSV Export

**Parent:** [PRD.md](PRD.md) sections 5.5, 5.6, 5.10, 6
**Milestones:** 8, plus CSV export and polish from 9
**Depends on:** 07

## 1. Goal

Give users an auditable view of every stock change, a dashboard that surfaces low stock early, and CSV exports of products and movements.

## 2. Scope

### In scope
- Stock Movements page and API.
- Dashboard page and API.
- CSV export for products and movements.
- Milestone 9 polish: SMTP (Brevo) configuration via env, final test pass.

### Out of scope
- Low-stock Telegram notifications, multi-warehouse (future).

## 3. Functional requirements

### 3.1 Stock Movements page
- Table: date, product (title + SKU), type, change, before, after, supplier, note, **performed by** (name with role badge).
- Filters: product (searchable select), type, supplier, **user (performed by)**, date range.
- Newest first, server-side pagination.
- CSV export of the filtered result.
- Reachable pre-filtered by user from the admin Users drawer (04).

### 3.2 Dashboard
- Summary cards: active products, total units, inventory value (price x quantity), low-stock count, out-of-stock count.
- Low-stock list ordered by lowest quantity-to-reorder ratio, with a quick **Receive** action (opens the 07 modal in Receive mode).
- Recent movements (last 10).
- Admins also see a **Pending approvals** card (uses `/users/pending-count`).
- Counts and value exclude archived products.

### 3.3 CSV export
- Products: respects current search and filters.
- Movements: respects current filters.
- Values starting with `=`, `+`, `-`, `@` are escaped to prevent spreadsheet formula injection.
- Available to admin and staff.

## 4. API

| Method | Path | Notes |
|---|---|---|
| GET | `/movements?product=&type=&supplier=&user=&from=&to=&page=&limit=` | each row includes `performedBy { id, name, role }` |
| GET | `/movements/performers` | people who made movements, `{ id, name }`, for the user filter (staff cannot list users) |
| GET | `/movements/export` | same filters, CSV |
| GET | `/products/export` | same filters as `/products`, CSV |
| GET | `/dashboard` | summary, low-stock list, recent movements |

## 5. Acceptance criteria
- Every movement is visible on the Movements page and filterable by user, product, type, supplier and date range.
- Dashboard numbers match the underlying data (checked in tests), and low-stock ordering follows the quantity-to-reorder ratio.
- Exports contain exactly the filtered rows, and a cell value like `=SUM(A1)` is escaped.
- Staff and admin can export; pending and incomplete users get 403.
- With SMTP env vars set to Brevo, verification and reset emails are delivered (manual check before launch; SPF and DKIM verified for the sender domain).
