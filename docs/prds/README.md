# Sub-PRD Index: Product Inventory Manager

The master document is [`PRD.md`](PRD.md) (v1.3, MVP). It is split here into eight sub-PRDs, one per delivery slice. Each sub-PRD can be built and tested on its own once the slices it depends on are in place.

**If a sub-PRD and `PRD.md` disagree, `PRD.md` wins.** Fix the sub-PRD.

| # | Sub-PRD | PRD sections | Milestone | Depends on |
|---|---|---|---|---|
| 01 | [Foundation and Platform](01-foundation.md) | 2, 6 (conventions), 8, 9, 10 | 1 | none |
| 02 | [Email Auth, Sessions and Mail](02-auth-email-sessions.md) | 4 (User, EmailToken, RefreshToken), 5.1B, 5.1D, 5.1E, Sessions | 2 | 01 |
| 03 | [Telegram Login and Identity Linking](03-telegram-identity.md) | 4 (AuthRequest), 5.1A, 5.1C, bot, 5.8, 5.9 | 3 | 01, 02 |
| 04 | [Roles, Access Gates and User Approval](04-roles-approval.md) | 3, access enforcement, admin bootstrap, 5.7, 5.8 | 4 | 02, 03 |
| 05 | [Categories and Suppliers](05-categories-suppliers.md) | 4 (Category, Supplier), 5.3, 5.4 | 5 | 04 |
| 06 | [Products Catalog](06-products.md) | 4 (Product), 5.2 (except stock actions) | 6, 9 (archive) | 05 |
| 07 | [Stock Engine and History](07-stock-engine.md) | 4 (StockMovement), 5.2 (stock actions), 7 | 7 | 06 |
| 08 | [Movements, Dashboard and CSV Export](08-movements-dashboard-export.md) | 5.5, 5.6, 5.10 | 8, 9 | 07 |

```
01 Foundation
 └─ 02 Email auth + sessions + mail
     └─ 03 Telegram + identity linking
         └─ 04 Roles + gates + approval
             └─ 05 Categories + suppliers
                 └─ 06 Products
                     └─ 07 Stock engine
                         └─ 08 Movements + dashboard + export
```

## Rules that apply to every sub-PRD

- Server-side checks are the source of truth. Hiding a button is only a convenience.
- Every protected route runs the gates in order: authenticate, load user, profile complete, status, role (see 04).
- Every write endpoint uses the `validate` middleware with a shared Zod schema from `shared/schemas`; client forms use the same schema.
- Errors use `{ message, code?, errors? }`; lists use `{ data, page, limit, total }`.
- One `AppError(status, code, message)` class and one error handler. No stack traces in responses.
- Tokens, OTPs and secrets are stored hashed and compared in constant time.

## Out of scope for the whole MVP

Multi-warehouse, purchase/sales orders, barcodes and images, native mobile app, social logins other than Telegram, 2FA on email login, changing a verified email, disconnecting Telegram. See PRD section 13 for future work.
