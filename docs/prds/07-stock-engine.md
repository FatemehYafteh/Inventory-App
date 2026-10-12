# Sub-PRD 07: Stock Engine and History

**Parent:** [PRD.md](PRD.md) sections 4 (StockMovement), 5.2 (inline quantity, Adjust stock, Stock history, initial stock), 7
**Milestone:** 7
**Depends on:** 06

## 1. Goal

Every quantity change is atomic, can never oversell, and leaves exactly one immutable movement that records who made it. This is the most important correctness rule in the system.

## 2. Scope

### In scope
- StockMovement model and `stock.service`.
- `POST /products/:id/stock` (receive, ship, adjust, increment, decrement).
- Initial stock on product creation.
- Inline +/- controls, Adjust stock modal, Stock history modal.

### Out of scope
- The global Movements page and CSV export (08).

## 3. Data model: StockMovement
- `product` (ref, required)
- `type`: `receive` | `ship` | `adjust` | `increment` | `decrement`
- `quantityChange` (signed integer), `quantityBefore`, `quantityAfter`
- `supplier` (ref, optional): snapshot of the product's supplier at the time of a `receive`
- `note` (optional)
- `performedBy` (ref User, **required**), `performedByName` (snapshot)
- `createdAt` (immutable). Movements are never edited or deleted.
- Indexes: `product + createdAt`, `type`, `supplier`, `performedBy + createdAt`

## 4. Functional requirements

### 4.1 Stock service (server)
One atomic conditional update inside a Mongo transaction, with the movement written in the same transaction:

```js
// delta < 0 must not go below zero; archived products are refused
const filter = { _id, isArchived: false, ...(delta < 0 && { quantity: { $gte: -delta } }) };
const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: delta } }, { new: true, session });
if (!product) throw new AppError(400, 'INSUFFICIENT_STOCK', '...');
await StockMovement.create([{ product: _id, type, quantityChange: delta,
  quantityBefore: product.quantity - delta, quantityAfter: product.quantity,
  performedBy: user._id, performedByName: user.name, supplier, note }], { session });
```

- `receive`: quantity > 0; stores the product's current supplier.
- `ship`: quantity > 0 and <= current.
- `adjust`: absolute target quantity; the delta is computed **inside the transaction**; same-as-current is rejected.
- `increment` / `decrement`: delta of 1 (inline buttons).
- `performedBy` always comes from the authenticated user. Any `performedBy` in the body is ignored.
- Only `active`, profile-complete users can reach this service (gates from 04).
- Archived products are refused until restored.

### 4.2 Initial stock
- An optional initial quantity on Add Product creates a `receive` movement with note "Initial stock", in the same transaction as the product insert.

### 4.3 Inline quantity
- `-` and `+` beside the quantity; each click is one `decrement` / `increment` of 1.
- `-` disabled at 0.
- Optimistic update via TanStack Query mutation, rollback on error. The server applies a delta, never an absolute value.
- Rapid clicks are queued so each request is correct.

### 4.4 Adjust stock modal (admin and staff)
- Modes: **Receive** (add > 0), **Ship** (remove > 0, <= current), **Adjust** (set absolute; same-as-current rejected).
- Optional note. Shows current and resulting quantity before submit.

### 4.5 Stock history modal (admin and staff)
- The product's movements: date, type, change, before, after, supplier, note, **performed by**. Newest first, paginated.

## 5. API

| Method | Path | Body | Access |
|---|---|---|---|
| POST | `/products/:id/stock` | `{ type, quantity, note }` | admin, staff |
| GET | `/products/:id/movements` | `page, limit` | active users |

## 6. Business rules
- Quantity never goes below 0; the server rejects with 400 `INSUFFICIENT_STOCK`.
- Quantity and history can never diverge: both are written in one transaction.
- `quantityBefore` / `quantityAfter` are captured at write time.
- A `receive` stores the supplier the product had at that moment; later supplier changes do not rewrite history.

## 7. Acceptance criteria
- Each stock action creates exactly one movement with correct before/after and `performedBy` set to the acting user.
- Shipping more than available is blocked.
- Archived products reject stock changes.
- Concurrency test: N parallel ships against limited stock never take quantity below 0, and the number of movements equals the number of successful updates.
- Rapid inline clicks end with the correct quantity and one movement per click.
- A `performedBy` sent in the body is ignored.
- Receives record the product's supplier.
- Unit tests for the stock service; integration tests for each type and each role/status gate.
