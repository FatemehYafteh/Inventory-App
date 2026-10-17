# Sub-PRD 05: Categories and Suppliers

**Parent:** [PRD.md](PRD.md) sections 4 (Category, Supplier), 5.3, 5.4, 6, 7
**Milestone:** 5
**Depends on:** 04 (gates and roles)

## 1. Goal

Admins maintain the categories and suppliers that products belong to. Staff can browse them read-only.

## 2. Scope

### In scope
- Category and Supplier models, APIs, Zod schemas, and pages.
- Navigation from a category card or supplier row to the Products page filtered by it (the Products page itself is 06).

### Out of scope
- Multiple suppliers per product (future).

## 3. Data models

### Category
- `title` (required, unique), `description`, timestamps
- Virtual `productCount` (includes archived products)

### Supplier
- `name` (required, unique), `contactPerson`, `phone`, `email` (valid format), `address`, `notes`
- `isActive` (default true), timestamps
- Virtual `productCount` (includes archived products) and `movementCount` (stock movements that reference the supplier)

## 4. Functional requirements

### 4.1 Categories page
- Responsive grid of cards: title, description, product count.
- Admin: Add, Edit, Delete. Staff: read-only cards.
- Delete is blocked with a clear message (409) if the category has any products, **including archived**.
- Clicking a card opens Products filtered by that category.

### 4.2 Suppliers page
- TanStack Table: Name, Contact person, Phone, Email, Product count, Actions.
- Search by name, contact person, phone or email; sort by name; server-side pagination.
- Admin: add, edit, deactivate / reactivate, delete. Staff: read-only.
- Delete blocked (409 `IN_USE`) if any product **or any stock movement** references the supplier. The response carries both counts (`productCount`, `movementCount`) and a message suggesting deactivation instead. The Delete button is enabled only when both counts are zero.
- Deactivated suppliers cannot be chosen for new products but stay on existing ones.
- Row link: Products filtered by that supplier.
- Form (React Hook Form + shared Zod): name (required), contact person, phone, email, address, notes.

## 5. API

| Method | Path | Access |
|---|---|---|
| GET | `/categories` | active users |
| POST | `/categories` | admin |
| PATCH | `/categories/:id` | admin |
| DELETE | `/categories/:id` | admin; 409 if products exist |
| GET | `/suppliers?search=&active=&sortBy=&order=&page=&limit=` | active users |
| POST | `/suppliers` | admin |
| PATCH | `/suppliers/:id` | admin (also used to deactivate / reactivate) |
| DELETE | `/suppliers/:id` | admin; 409 `IN_USE` if products or stock movements reference it |

## 6. Acceptance criteria
- A category with products (including archived) cannot be deleted. A supplier with products (including archived) or stock movements cannot be deleted; the 409 reports both counts and suggests deactivating. The UI shows a clear message.
- Staff see read-only pages and get 403 from every write endpoint.
- Duplicate category title or supplier name is rejected.
- Deactivated suppliers do not appear in the supplier picker for new products.
- Supplier search, sort and pagination run server-side.
