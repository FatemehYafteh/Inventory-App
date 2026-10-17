# M5 implementation plan: categories and suppliers

Inputs: `docs/prds/05-categories-suppliers.md`, PRD 4 (Category, Supplier), 5.3, 5.4, 6, 7, `tasks/task.md` (M5), `GLOSSARY.md` (Categories and suppliers).
Interview held on 2026-10-17 (questions Q1 to Q10, all recommendations accepted). Q3 was settled after an assessment of the race (3.7); Q10 (supplier delete and stock movements) after a gap found in the model.

This plan has four separate parts: **1 Decisions** (settled with the owner), **2 Assumptions** (taken as true; what breaks if wrong), **3 Changes** (scope, behavior, edge cases, data, API, tickets), **4 Unknowns** (open, with who resolves them).

---

## 1. Decisions

| # | Decision |
|---|---|
| Q1 | A duplicate category title or supplier name returns 409 `DUPLICATE_NAME` with a field-level message ("A category with this title already exists"). Comparison is case-insensitive, matching the existing collation indexes. The form shows the message under the title or name field. |
| Q2 | A blocked delete returns 409 `IN_USE`, with the count in the message ("Used by 3 products, including archived ones"). The UI disables Delete when `productCount > 0` (tooltip explains), and still handles the 409 (toast, refresh the row) in case the data changed since the page loaded. |
| Q4 | `GET /suppliers`: `active` omitted = all, `true` = active only, `false` = inactive only. Staff and admins both see inactive suppliers in the table with an "Inactive" badge. The M6 product picker calls `active=true`. `search` is a case-insensitive substring match with regex characters escaped, across name, contactPerson, phone and email. `sortBy` accepts only `name` (asc by default). `limit` defaults to 20 and is capped at 100. |
| Q5 | An inactive supplier stays fully editable. `PATCH /suppliers/:id` with `isActive` is the only deactivate and reactivate path. Deactivating a supplier that still has products is allowed, with a normal confirm dialog. |
| Q6 | On create and PATCH, an empty string for `description`, `contactPerson`, `phone`, `email`, `address` or `notes` clears the field (stored as unset). `email` is validated for format only when non-empty. `phone` is free text, max 40 characters. The rules live in the shared Zod schemas. |
| Q7 | M5 renders links as `/products?category=<id>` and `/products?supplier=<id>`, the same query names the products API will use. `ProductsPage` does not exist until M6, so until then the links reach the 404 page. M6 makes them work and its acceptance criteria check the contract. |
| Q8 | Keep the four tickets as written in `tasks/task.md`. Each API ticket ships its server implementation and server tests. Each page ticket ships its client implementation and client tests. Cross-layer tests where useful (see 3.5). The seed is verified, not rewritten (see 3.4). |
| Q9 | `GLOSSARY.md` gains Category, Supplier, Active supplier, Inactive supplier, Deactivate and Product count. No ADR: nothing here is hard to reverse or surprising. |
| Q10 | Supplier delete is blocked while any Product **or any StockMovement** references the supplier. The 409 `IN_USE` response carries both counts (`productCount`, `movementCount`) and a message that suggests deactivating instead ("Used by 2 products and 14 stock movements. Deactivate it instead."). Supplier responses include `movementCount` alongside `productCount`, and the UI enables Delete only when both are zero (tooltip explains). This extends the PRD rule, which names products only; update sub-PRD 05 section 4.2, section 5 and section 6 to match. Categories are unchanged (products only). |
| Q3 | Option C (see 3.7). In M5, category and supplier deletion runs in a Mongo transaction and counts every referencing product, archived included. In M6, product create and update first write ("touch") the referenced Category, and the Supplier when one is set or changed, so they conflict with a concurrent delete of the same document. M6 includes the concurrency test. **Full race protection depends on the M6 changes being implemented**; until then M5 alone does not close the race (it is harmless only because no products can be created before M6). |

---

## 2. Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | `Category` and `Supplier` models already exist in `server/src/models/` with case-insensitive unique indexes and a `productCount` virtual, and need no changes. | Add the missing fields or indexes in 5.1 and 5.3. |
| A2 | `protect(...roles)` from M4 is the gate for every new data route: reads use it with no role argument (any active user), writes with `'admin'`. Staff therefore get 403 on every write. | Add the missing role check per route. |
| A3 | The `productCount` virtual counts archived products, as the PRD requires. List endpoints should not populate it per row (N+1); use one aggregation or grouped count for the page. | Counts would be wrong or slow; fix in the service. |
| A4 | Categories are few (tens, not thousands), so `GET /categories` returns all of them sorted by title, with no pagination or search. | Add paging as for suppliers. |
| A5 | Validation errors on write endpoints use the existing `validate` middleware and the shared `AppError`/error handler shape, as in M4. | Follow whatever shape M4 actually uses. |
| A6 | Client data fetching follows the M4 pattern (TanStack Query hooks in `client/src/hooks`, toasts for errors). `CategoryCard`/`CategoryForm` and `SupplierTable`/`SupplierForm` go in the existing empty `components/categories` and `components/suppliers` folders. | Place files to match what M4 did. |
| A7 | The existing seed already satisfies the PRD rules and covers the edge cases (see 3.4). | Extend the seed, explaining why first. |
| A8 | Nothing creates products before M6 (no product routes or services exist yet), so no real race exists in M5; the race is created, and must be closed, in M6. | Revisit 3.7. |

---

## 3. Changes

### 3.1 Scope

In: Category and Supplier APIs, shared Zod schemas, the two pages and their components and hooks, nav items if not already present. Out: Products page and product forms (M6), multiple suppliers per product.

### 3.2 Server

- **Categories** (`categories.service.js`): list (all, by title, with `productCount`), create, update, delete. `DUPLICATE_NAME` on a duplicate key (map the Mongo error). `IN_USE` on delete when a product references the category, archived included.
- **Suppliers** (`suppliers.service.js`): list with search, `active`, `sortBy=name`, `order`, `page`, `limit` and `productCount`; create, update (including `isActive`), delete with the same two errors.
- **Routes and controllers** are thin and follow the table in sub-PRD 05 section 5. Every write uses `validate` with a schema from `shared/schemas` (`category.js`, `supplier.js`, exported from `index.js`).
- Responses carry `productCount` on every category and supplier returned, and `movementCount` on every supplier (one grouped count over `StockMovement.supplier`; add a `{ supplier: 1 }` index check, the PRD already lists one).

### 3.3 Client

- `/categories`: responsive grid of cards (title, description, product count); admin sees Add, Edit and Delete, staff sees plain cards. A card links to `/products?category=<id>`.
- `/suppliers`: TanStack Table in manual server mode (Name, Contact person, Phone, Email, Product count, Actions), search, sort by name, pagination, "Inactive" badge. Admin actions: add, edit, deactivate or reactivate, delete. A row links to `/products?supplier=<id>`.
- Forms use React Hook Form with the shared Zod schemas. Field-level `DUPLICATE_NAME` messages. Empty, loading and error states on both pages.

### 3.4 Seed data

Checked, no change needed. `server/seed/data/` already has `Seasonal` (no products, deletable), `Northwind Freight` (no products, deletable), `Old Mill Paper Co.` (inactive, still on products), archived products, and every other category and supplier in use. `server/tests/seed/seed.test.js` already asserts these cases.

One gap: no category or supplier has only archived products. That rule ("archived counts toward blocking delete") is tested in the API tests with their own fixtures, so the shared seed stays unchanged. If the owner wants it visible in the UI, extend the seed and `seed.test.js` together, explaining why first.

### 3.5 Tests

- **API (5.1, 5.3):** supplier delete blocked by movements alone (no products) with both counts in the 409 body; happy path, validation errors, duplicates (case-insensitive), Staff 403 on every write, unauthenticated and pending users refused, 409 `IN_USE` for active-only, archived-only and mixed products, supplier search, sort, paging and `active` filter, deactivate and reactivate, empty-string clearing.
- **Pages (5.2, 5.4):** supplier Delete disabled unless both counts are zero; admin versus staff views, disabled Delete with tooltip, 409 fallback, form `DUPLICATE_NAME` message, link targets with the agreed query names, empty, loading and error states.
- **Cross-layer:** per API ticket, one test against the real seeded data: `Seasonal` and `Northwind Freight` show a count of 0 and delete successfully, an in-use row shows a count above 0 and its delete returns 409.

### 3.6 Tickets

Four issues, each labeled `enhancement` and `ready-for-agent`, each blocked by the one before. Titles are `M5: Categories API`, `M5: Categories page`, `M5: Suppliers API`, `M5: Suppliers page`, matching tasks 5.1 to 5.4. They do not exist yet.

### 3.7 Delete integrity (Q3), approved: option C

**What exists today.** Only the models. `Product.category` (required) and `Product.supplier` (optional) are plain ObjectId refs; MongoDB has no foreign keys, so nothing stops a product pointing at a deleted category. No product create or update code exists until M6. `StockMovement.supplier` is a second ref to Supplier. Transactions are already in use (`withTransaction` in auth and account-link services, `server/tests/db/transaction.test.js`) and tests run on a replica set.

**The race.** Delete reads "no products use category C", then deletes C. A product create reads "C exists", then inserts a product pointing at C. If these interleave, C is gone and a product (possibly the only one) references it. Archived products matter because the count in the delete check must include them (`Product.exists({ category })` with no `isArchived` filter), which the plan already requires.

**Why a transaction on the delete alone does not fix it.** Under MongoDB's snapshot isolation the two transactions write *different* documents (one deletes a Category, the other inserts a Product), so there is no write conflict and both commit. This is write skew. Wrapping only the delete, or only the create, in a transaction changes nothing.

| Option | Reliable? | Cost |
|---|---|---|
| A. Plain check-then-delete (the earlier recommendation) | No: window is tiny but real | None |
| B. Transaction on the delete only | No (write skew, above) | Looks safe, is not |
| C. Both sides transactional, and product create/update first *writes* to the Category (and the Supplier, when one is chosen) | Yes: both transactions write the same document, so MongoDB aborts one with a write conflict; `withTransaction` retries it and it then sees the other's result | Small: product create/update already needs a transaction for the initial-stock movement; concurrent creates in the same category can conflict and retry, which is harmless at this volume |
| D. Soft-delete categories and suppliers (archive instead of delete) | Yes | Changes the PRD (delete is a stated requirement), and adds states to both pages |
| E. Insert first, then verify the category exists and compensate | Mostly | Compensation code is harder to get right than C |

**Decision: C, split across two tickets (approved by the owner). Full protection needs both halves; M5 alone does not close the race.**
- **M5 (5.1 and 5.3):** the delete service runs in a transaction: count products (archived included), then delete the document. This is correct on its own for the case where nothing writes concurrently, and it is the half M6 depends on.
- **M6 (product create and update):** inside the product's transaction, first touch the referenced documents: `Category.updateOne({ _id }, { $set: { updatedAt: now } })` (matched count 0 means 400 "category not found"), and, when a supplier is set or changed, the same on the Supplier, filtered on `isActive: true` for a newly chosen supplier. Stock changes (receive, ship, adjust) do not touch them.
- **M6 test:** run delete and create concurrently (`Promise.all`, many iterations) and assert the invariant "no product references a missing category or supplier", for both the delete-wins and create-wins outcomes.
- Write this requirement on the M6 ticket as an acceptance criterion and in the M6 plan, and say there that M5 deletion is only race-safe once it is done.

**Supplier deactivation versus a new product** is benign: the product is allowed to keep a supplier that goes inactive a moment later, so it needs no extra handling beyond the `isActive` filter above.

**Dangling movement references (Q10, approved).** `StockMovement.supplier` also refs Supplier, so deleting a supplier that appears only on old receives would leave history pointing at nothing. The supplier delete check therefore counts products and movements, in the same transaction as the delete. See Q10. The alternative (snapshotting `supplierName` on the movement) is a model change that belongs to M7 and is not needed now. Race note: a receive in M7 records the product's current supplier, and a product that still references the supplier already blocks the delete, so no extra touch is needed for movements.

---

## 4. Unknowns

| # | Unknown | Who resolves |
|---|---|---|
| U2 | Whether to seed a category or supplier that has only archived products (see 3.4). Default: no, test it with fixtures. | Owner |
| U3 | Whether the sidebar already has Categories and Suppliers items, and whether staff see them. Verify during 5.2 and 5.4. | Implementer |
| U4 | The exact error response shape used by M4, for the client to read `code` and `message`. Verify during 5.1. | Implementer |
