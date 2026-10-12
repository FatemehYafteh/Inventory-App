# Sub-PRD 06: Products Catalog

**Parent:** [PRD.md](PRD.md) sections 4 (Product), 5.2 (except stock actions), 6, 7, 8
**Milestones:** 6, plus archive/restore from 9
**Depends on:** 05

## 1. Goal

Staff can find any product quickly and create or edit products. Admins can archive and restore them. Quantity is shown here but changed only by the stock engine (07).

## 2. Scope

### In scope
- Product model, indexes, derived stock status.
- Products page: header, search, filters, server-driven table, sort, pagination, URL state.
- Add / Edit product forms.
- Archive / Restore (admin only).

### Out of scope
- Inline +/-, Adjust stock modal, Stock history modal, and the "Initial stock" movement (07). The table leaves slots for them.
- CSV export of products (08).

## 3. Data model: Product
- `title` (required); `sku` (required, unique, stored uppercase, case-insensitive)
- `description`; `category` (ref, required); `supplier` (ref, optional, one per product)
- `price` (number >= 0, 2 decimals, required)
- `quantity` (integer >= 0, default 0); `reorderLevel` (integer >= 0, default 0)
- `isArchived` (default false), `archivedAt`, timestamps
- Indexes: `sku`, `category`, `supplier`, `title`, `quantity`, `price`, `isArchived`

**Derived stock status**
- `out_of_stock`: quantity = 0
- `low_stock`: 0 < quantity <= reorderLevel
- `in_stock`: quantity > reorderLevel

## 4. Functional requirements

### 4.1 Page
- Header: title, **Add Product**, search input.
- Search: title and SKU, debounced 300 ms.
- Filters: Category, Supplier (single selects), Stock status (All / In / Low / Out), "Show archived" (admin only, default off).
- Search, filters, sort and page live in the URL query string.

### 4.2 Table (TanStack Table, manual server mode)
- Columns: Title (SKU underneath), Category, Supplier, Price, Quantity, Stock status badge (not colour only), Created date, Actions.
- Sort by Title, Quantity or Price, asc/desc, server-side across the whole dataset.
- Pagination server-side, default 20, selectable page size.

### 4.3 Add / Edit
- Sheet or modal, React Hook Form + shared Zod.
- Fields: title, SKU, description, category, supplier (only active suppliers for new choices), price, reorder level.
- Quantity is not editable here. Add Product has an optional initial quantity, handed to the stock engine (07) as a `receive` "Initial stock".

### 4.4 Archive / Restore (admin only)
- Confirm dialog. Not rendered for staff; API returns 403 for staff.
- Archived products are hidden by default and cannot receive stock changes until restored (enforced in 07).

## 5. API

| Method | Path | Access |
|---|---|---|
| GET | `/products?search=&category=&supplier=&status=&archived=&sortBy=&order=&page=&limit=` | active users |
| POST | `/products` | admin, staff |
| GET | `/products/:id` | active users |
| PATCH | `/products/:id` | admin, staff |
| PATCH | `/products/:id/archive` | **admin only** |
| PATCH | `/products/:id/restore` | **admin only** |

## 6. Acceptance criteria
- Product list responds in under 300 ms at 10,000 products.
- Sorting by title, quantity and price covers the whole dataset, not only the current page.
- Stock status filter and badges follow each product's reorder level.
- SKU uniqueness is case-insensitive.
- Staff can create and edit products but have no archive action in the UI and get 403 from the archive endpoint.
- Refreshing the page keeps search, filters, sort and page.
- Forms validate with the same Zod schemas on client and server.
