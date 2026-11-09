# Client rules (React, Vite, Tailwind, shadcn/ui)

Applies in addition to the root `CLAUDE.md`. Requirements: `docs/PRD.md` sections 3 and 5.

## Structure
```
client/src/
  components/ui/          shadcn components; D2 hand-edited them onto the design tokens, keep them token-only
  components/data-table/  reusable TanStack Table wrapper (sortable header, pagination, toolbar)
  components/products/    ProductTable, ProductFilters, StockAdjustDialog, StockHistoryDialog, ProductForm
  components/categories/  CategoryCard, CategoryForm
  components/suppliers/   SupplierTable, SupplierForm
  components/users/       UsersTable (cards on small screens), UserDrawer, Reject/ChangeRole dialogs
  components/PageMeta.jsx tab title and robots noindex per route (see lib/pageMeta.js)
  pages/                  one file per route
  lib/                    api client, queryClient, auth, guards, and the TanStack Query hooks per
                          area (products.js, users.js, movements.js, ...), demo.js, pageMeta.js
  hooks/useMediaQuery.js  useIsMobile (below 768px: filters in a bottom sheet),
                          useIsCompact (below 1024px: tables become cards)
  test/                   render helper, MSW server, mobile.js (mockMobile, mockTablet)
```

## Conventions
- Server data: TanStack Query only. Query keys are arrays like `['products', filters]`. No data fetching in components with `useEffect`.
- Tables: TanStack Table in manual mode (`manualSorting`, `manualPagination`, `manualFiltering`). Sorting, filters, search and page live in the URL query string and are sent to the server.
- Forms: React Hook Form + `zodResolver` using the schemas from `shared/schemas`. Show server errors on the matching field.
- API client: one Axios instance (`withCredentials: true`, header `X-Requested-With`) in `lib/api.js`. A response interceptor retries once after a 401 by calling `POST /auth/refresh` and turns every failure into `ApiError` (`{ message, code, errors }`); if refresh fails, the session-expired handler sends the user to login. Pages call `api()` through TanStack Query hooks, never Axios directly.
- Never store tokens anywhere in the client. There are none to store, they are httpOnly cookies.
- Route guards follow the server gates: not logged in goes to Login; incomplete profile goes to Complete profile; `pending` goes to Awaiting approval; `rejected` sees access denied; admin-only pages hide for staff.
- Role-based UI is only a convenience. The server enforces everything (staff must never see the Archive action).
- Inline quantity +/-: optimistic update with rollback on error. Send a delta, never an absolute value. Queue rapid clicks.
- Use shadcn components and Tailwind utilities. Stock status is shown with text plus color, never color alone.
- Colour comes from the design tokens only (`src/index.css`). No hard-coded hex or palette utilities (`bg-white`, `text-white`, `emerald-*`, `bg-black/50`) in components. Use `text-primary-text` for blue text, `text-danger` for error text and a full-strength `ring-ring`. See `docs/design-system.md`.
- The app has a light and a dark theme (`ThemeSwitcher`, saved in the browser). Tokens carry both, so token-only code works in both; check a new screen in dark too. See "Theme switching" in `docs/design-system.md`.
- Keyboard accessible dialogs, tables and the OTP input (use the shadcn input-otp component).
- Show loading, empty and error states on every list and form.

## Testing
- Vitest + React Testing Library + MSW. Test forms (validation messages), table sorting/filter wiring, the inline +/- behavior, and route guards.
- Tests mock the API with MSW handlers (`src/test/server.js`) that follow the shapes in `docs/PRD.md` section 6. Use `mockMobile()` / `mockTablet()` from `src/test/mobile.js` for the card and sheet layouts.
