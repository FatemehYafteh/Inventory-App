# Handoff: M6 Products catalog, server done; Design Foundation planned (2026-10-18)

This replaces the M5 handoff of 2026-10-17, which was never committed. It is kept word for word in the appendix at the end of this file.
Written at the end of the session. Each claim carries a tag saying where it comes from:

- **[checked now]**: observed by read-only commands or test runs immediately before this file was finalized (2026-10-18).
- **[reported earlier]**: observed earlier in this same session and not re-run for this file.
- **[prior session]**: copied from an older handoff and not re-checked.
- **(verify)**: not checked at all.

## 1. Where things stand

**Git and GitHub state [checked now]** (read-only commands run just before finalizing):

- **Branch:** `feat/products`. HEAD is `2a5e8c4` `feat: M6: Products API (6.1-6.3)`, one commit on top of `769f39b`, the tip of `feat/categories-suppliers`.
- **Remote:** before this file was committed, `feat/products` had no upstream and `git ls-remote --heads origin feat/products` returned nothing, so neither the branch nor `2a5e8c4` was on `origin`. The commit that adds this file is the first push of the branch, so `origin/feat/products` exists from that point; `git log origin/feat/products` shows the current state. `feat/categories-suppliers` is on `origin` at `769f39b`.
- **Working tree:** only `HANDOFF.md` was modified. Nothing staged, nothing untracked, no stash.
- **GitHub:** issues #15 to #18 (M5) are open and close when the M5 PR merges. `gh pr list` shows only PRs #8 (M3) and #14 (M4), both merged. No PR exists for M5 or M6. No M6 issues exist, so M6 was done phase by phase from `tasks/task.md`, each phase approved by the owner before the next.
- `tasks/task.md` marks 5.1 to 5.4 and 6.1 to 6.3 as Done, and 6.4 to 6.6 as To do.

**Completed work: Phases 6.1 to 6.3, the Products API.** Committed in `2a5e8c4`. Code and tests are in section 4; results are in section 5.

| Phase | Task |
|---|---|
| 6.1 | Products list API |
| 6.2 | Create and edit API (plus the supplier race test and the comment fixes) |
| 6.3 | Archive and restore API (plus the staff-edit-versus-archive tests) |

**Remaining work: not started.** Nothing below exists in the code.

| Phase | Task | State |
|---|---|---|
| 6.4 | Products page table | Next, waiting on the Design Foundation decision |
| 6.5 | Add and Edit product form | To do |
| 6.6 | Archive and restore in the UI | To do |
| none | Design Foundation (D0 to D6) | Planned only (section 6); no file, branch or task row created |

## 2. Git state to sort out before opening any PR (verify)

[checked now] Local refs only; nothing was fetched this session, so remote-tracking refs may be stale.

- `origin/sub-prds` is at `60ef3a6` (merge of PR #14, M4). It is **not** an ancestor of `feat/products`. The local `sub-prds` (`7404e65`) is far behind it.
- Local `feat/roles-approval` is 5 commits ahead of its remote (the M5 docs commits). All five are ancestors of `feat/products` [checked now].
- `gh pr list` shows only PR #8 (M3) and PR #14 (M4), both merged. `gh issue list` shows #15 to #18 open.
- The owner decided M6 stacks on the unmerged M5: **PR order is M5 first, then M6**. Target the M6 PR at the M5 branch, or retarget it once M5 merges. Squash merges rewrite hashes, so a plain rebase onto `origin/sub-prds` may conflict. **Do not rebase, merge or change the base without the owner's explicit approval.**

## 3. Decisions [reported earlier: made and approved by the owner in this session]

| # | Decision |
|---|---|
| D1 | Initial quantity is **out of M6**. New products start at quantity 0. The create and update schemas are strict, so `quantity`, `initialQuantity`, `isArchived` and any unknown field return 400. `initialQuantity` and the "Initial stock" `receive` movement arrive together in M7 task 7.3, inside the stock engine's single transaction. |
| D2 | Branch `feat/products` off `feat/categories-suppliers`; PR order M5 then M6. |
| D3 | Stock status is **computed in the query** with `$expr` (no stored field), so M7's atomic quantity updates cannot drift from it. |
| D4 | Staff sending `archived=true` get **403 `FORBIDDEN`**. Staff requesting an archived product by id get **404 `NOT_FOUND`**. Admins see archived products. |
| D5 | `archived=true` means "**include** archived products" (a "Show archived" checkbox), not "archived only". Default and `archived=false` hide them. Confirmed by the owner. |

Defaults used in the API (taken from the approved plan; the owner approved the plan as a whole):

- Search is a case-insensitive, regex-escaped substring match on `title` and `sku`. Sort fields are `title` (case-insensitive collation), `quantity` and `price`, with `_id` as tiebreaker. `limit` defaults to 20, max 100. Invalid `category` or `supplier` ids return 400.
- SKU is trimmed and uppercased by the shared schema and again by the model; the unique index has no collation. Duplicate returns 409 `DUPLICATE_SKU` with `errors.sku`.
- Price is rounded to 2 decimals. `reorderLevel` is a whole number of 0 or more. `null` or `''` clears the supplier; an empty description clears it.
- A newly chosen supplier must be **active** (400 on `supplier` otherwise). A product may keep an inactive supplier it already has.
- Staff PATCH on an archived product returns 404; admins may edit archived products.
- Archive and restore are admin only. Archive sets `isArchived` and `archivedAt`; restore clears them. Already archived returns 409 `ALREADY_ARCHIVED`; not archived returns 409 `NOT_ARCHIVED`.
- **Q3 from the M5 plan is implemented:** product create and update run in a Mongo transaction and write (`$currentDate` on `updatedAt`) the referenced Category, and the Supplier when set or changed, so a concurrent delete conflicts instead of leaving a dangling reference. The old "needs M6" comments in `categories.service.js` and `suppliers.service.js` were corrected.

## 4. What exists in the code now

- **Server:** `server/src/services/products.service.js`, `controllers/products.controller.js`, `routes/products.routes.js`, registered in `app.js` at `/api/products`. Shared Zod schemas in `shared/schemas/products.js` (`createProductSchema`, `updateProductSchema`, `listProductsQuerySchema`).
- **API:** `GET /products` and `/products/:id` (any active user), `POST /products` and `PATCH /products/:id` (admin, staff), `PATCH /products/:id/archive` and `/restore` (**admin only**). Items carry `stockStatus`, `category {id,title}`, `supplier {id,name}|null`, `price`, `quantity`, `reorderLevel`, `isArchived`, `archivedAt`.
- **Tests:** `server/tests/routes/products.routes.test.js` (15), `products.write.routes.test.js` (24), `products.archive.routes.test.js` (13). They cover each gate, validation, the unknown-field rejection, case-insensitive SKU, the supplier-active rule, the archived rules, the delete-versus-write races (category, supplier, edit-to-another-category, supplier-only edit), a staff edit overlapping an admin archive (a gated deterministic overlap plus staggered real requests), and a 10,000-product timing test.
- **Client:** nothing for products yet. `client/src/components/products/` has only a README. The Categories and Suppliers pages already link to `/products?category=<id>` and `/products?supplier=<id>`; those still reach the 404 page. There is no `/products` route or nav item, and no `lib/products.js`.
- **Seed:** no model changed, so no seed change. The seeded products already cover each stock status, archived products, a product with no supplier and an inactive supplier (`Old Mill Paper Co.`).
- **Reusable for the client:** `DataTable` (server-driven, accepts a `toolbar`), `DataTablePagination` (page sizes 10, 20, 50, 100), `Badge` (always carries text), `Select`, `Input`, `Sheet`, `useZodForm`, `useReturnFocus`, `lib/errors.js`, the `SuppliersPage` and `SupplierTable` pattern (URL state, debounce, loading, empty and error states), and `useCategories`.

## 5. Verification (what was re-run and what was not)

**Re-run immediately before finalizing this file** [checked now] (HEAD `2a5e8c4`, only `HANDOFF.md` modified):

| Check | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm test -w server` | exit 0, 31 files, 353 tests passed |
| `npm test -w client` | exit 0, 19 files, 187 tests passed, no unhandled errors printed |
| `it(` blocks in the three products test files (counted) | 15 + 24 + 13 = 52 |

**Reported earlier in this session, not re-run for this file**

- Prettier on all touched files was clean when checked.
- Performance: the 10,000-product list measured 27 to 169 ms across four query shapes (limit 300 ms) on an in-memory MongoDB replica set, from a one-off script that was deleted afterwards. The committed timing test asserts the median of three warm requests per shape; the measured values are not recorded anywhere in the repo.
- Mutation checks, each restored afterwards: removing the Category/Supplier touch fails the race tests; removing the conditional archive filter fails the 409 and simultaneous-archive tests; removing the staff archived-check fails the gated overlap test and the archived-edit test.
- Probes: `page=1e20` and `page=9007199254740991` return 200 with an empty page; an admin edit racing an archive stayed consistent in 10 attempts.

**From the previous (M5) handoff, not re-checked and superseded** [prior session]: server 275 tests and client 160 tests at commit `ec925fc`, and 10 unhandled client `AggregateError`s. The client run just now printed none; why they are gone was not investigated.

**Never run:** a browser, `npm run dev`, `npm run seed`. The API has not been exercised outside the tests.

## 6. Design Foundation (planned, nothing created yet)

Everything in this section is a proposal discussed in this session [reported earlier]. Nothing has been created or implemented.

The owner wants the site design settled **before Phase 6.4**, as its own phase with local commits only, one per approved step, no push. Proposed branch: `feat/design-foundation` off `feat/products` (not created). Constraint: UI only, no changes to API contracts, backend behaviour, authentication, permissions, business logic or form validation.

**Decisions so far**

- Primary blue **#2563EB**, hover **#1D4ED8** (the owner's values).
- Layout: **dark navy sidebar, light main area**. The owner prefers this over the current top navigation; the layout impact analysis (below) still needs approval.
- System font stack, light mode only.
- Navy value is **proposed, not confirmed**: `#0F1E3D`. Page background `#F8FAFC` with white cards (proposed).
- Contrast ratios computed by a script earlier in this session (not re-run). All text pairs pass WCAG AA (4.5); the ring needs only 3: white on #2563EB 5.17; white on #1D4ED8 6.70; #2563EB on white 5.17; body #0F172A on #F8FAFC 17.06; muted #64748B on white 4.76 and on #F8FAFC 4.55; sidebar text #E2E8F0 on navy 13.38; sidebar muted #94A3B8 on navy 6.43. The #2563EB focus ring on navy is only 3.19, so the sidebar should use #93C5FD (9.15).

**Layout impact (sidebar)** summary: `AppLayout.jsx` is rewritten; below `lg` it becomes a navy top bar with the nav in the existing `Sheet`; `MinimalLayout` (pending users) keeps a navy top bar; desktop content width drops by about 15rem (Products table has 8 columns and will scroll sideways more at 1024 px); `CategoriesPage` grid (`sm:grid-cols-2 lg:grid-cols-3`) should move to container breakpoints; keep the desktop sidebar links always in the DOM so page tests that find nav links by name keep working. One nav landmark labelled "Main" at a time, plus a skip link.

**Plan D0 to D6** (each step stops for the owner's review; one local commit per approved step, named files only)

| Step | Work | Main files |
|---|---|---|
| D0 | Add a "Design Foundation" section to `tasks/task.md` | `tasks/task.md` |
| D1 | Tokens for light and dark themes (`:root` and `.dark`; the app stays light, nothing applies `.dark`), hover token, radius 0.5rem, system font stack, tabular numbers, success/warning/danger/neutral tokens, static light `theme-color` `#F8FAFC`, contrast test | `client/src/index.css`, `client/index.html`, `client/src/styles/tokens.test.js` |
| D2 | Components on tokens: `success`, `warning` and `danger` badge variants; button hover, input and select placeholders, full-strength focus rings on the seven `ui/` components that had one, `bg-overlay` on the three overlays, toaster icons, `FormAlert`, and `text-danger` in `TextField`, `TelegramSignIn` and `dropdown-menu`; source guard in `ui/ui.test.jsx`. Card and table were already token-driven and are unchanged | `client/src/components/ui/*`, `form/FormAlert.jsx`, `form/TextField.jsx`, `auth/TelegramSignIn.jsx`, `ui/ui.test.jsx` |
| D3 | Shell: navy sidebar from `lg` (15rem) with icons, pending badge and the account area in its footer; below `lg` a navy top bar whose menu opens the same navigation in the `Sheet`; skip link to `main#main`; `MinimalLayout` on the navy bar; Categories grid on container queries (`@lg` 2 columns, `@3xl` 3) | `layout/AppLayout.jsx`, new `layout/SidebarNav.jsx`, `layout/AppLayout.test.jsx`, `layout/MinimalLayout.jsx`, `pages/CategoriesPage.jsx` |
| D4 | `PageHeader` (level-1 heading with optional description and actions, ref forwarded for focus return) and `StatusBadge` (status to badge colour, text always shown; also maps the stock statuses for 6.4). The five headings use `PageHeader`; Users, the user drawer and Suppliers use `StatusBadge`, keeping the stored lower-case user status text | new `layout/PageHeader.jsx`, `StatusBadge.jsx` (+ tests), the five pages, `UsersTable.jsx`, `UserDrawer.jsx`, `SupplierTable.jsx` |
| D5 | Browser pass at about 360, 768, 1024 and 1280 px as admin and staff (written report) | none |
| D6 | `docs/design-system.md` and a "tokens only" line in `client/CLAUDE.md` (note that D2 deliberately hand-edits `components/ui/`) | docs |
| T | Theme switching and persisted preference (applies `.dark`); planned separately after D6, not started | later |

**Follow-up left by D2 (page-level, not changed):** `DataTableColumnHeader`, `DataTablePagination`, `SupplierTable` and `UsersTable` still use the faint `ring-ring/50` focus ring (about 2.1:1 in light mode, below the 3:1 a focus indicator needs). `ui/command.jsx` still uses `placeholder:text-muted-foreground`. Neither blocks D2; fix them in a step you approve.

**Notes from D3:** Log out and the user link live only in the sidebar footer and the mobile menu (one Log out button at a time; the tests find it by role). The mobile menu's close button keeps the page ring `#2563EB`, which is 3.19:1 on the navy sheet: above the 3:1 minimum but with little margin; `sheet.jsx` was out of D3 scope. The desktop content area is 15rem narrower, so the Products table will scroll sideways more at 1024px. Nothing has been seen in a browser yet (D5).

**Notes from D4 (check in D5):** a rejected user's badge is now the soft red `danger` badge instead of the solid `destructive` one (`Badge`'s `destructive` variant is kept but unused). The Dashboard welcome line is now the `PageHeader` description (small muted text, it was base size). `PageHeader` actions wrap below the title on narrow screens. `AwaitingApprovalPage` and `ProfilePage` still use `CardTitle` as their `<h1>`; they were not in the plan. `Badge` has no neutral variant, so `inactive` and `archived` use `outline`.

Out of scope: server, `shared/`, per-page content redesign, charts and dashboard palette, dark mode switching (tokens exist from D1; the toggle is phase T), sidebar collapse, Phase 6.4.

**Waiting on the owner:** approval of the sidebar impact analysis, a navy hex (or approval of `#0F1E3D`), approval of D0 to D6, and the choice of A, B or C for handling this file's uncommitted changes before the branch is created (A: branch with the file left as is; B: the owner commits or moves it first; C: stash and restore).

## 7. Phase 6.4 plan (waiting on the design decision)

Plain-language plan, not yet approved: add `lib/products.js` (`useProducts`, keeping previous rows visible while refetching); a `/products` route and a "Products" nav item for all active users; a page with a 300 ms debounced search, category and supplier selects, a stock-status select and an admin-only "Show archived" checkbox; a `DataTable` with Title (SKU underneath, "Archived" badge), Category, Supplier, Price, Quantity, Stock status badge, Created date; sortable Title, Quantity and Price; all state in the URL; msw-based tests; then lint, Prettier, both suites and a first real browser check with the seed.

Open recommendations for 6.4, to be confirmed with the design: no Actions column and no "Add Product" button until 6.5/6.6; USD formatting in one helper (currency is unspecified in the PRD); the supplier filter can load at most 100 suppliers (the API cap, which must not change); ignore `?archived=true` in the page for non-admins so staff never send it; fall back to defaults on invalid URL values; an optional "Clear filters" button.

## 8. Known limitations and open items

- **Nothing has run in a browser** (no dev server, no seed run). The first real check belongs to the Design Foundation or 6.4.
- The 300 ms figure is measured on an in-memory database with no network hop; it is a regression guard, not a production guarantee. Query plans and index use were not inspected.
- SKU case-insensitivity depends on every write going through Mongoose (the unique index has no collation). Nothing in the app writes around it.
- Quantity is protected by the strict Zod schemas at the route; the service functions do not strip it themselves. M7's stock service is the only intended writer.
- There is no `archivedBy` field. Blocking stock changes on archived products is M7's job.
- The race tests are timing based; a pass cannot prove every interleaving. They fail when the protection is removed.
- Carried over from M5: M4's `RejectUserDialog` and `ChangeRoleDialog` probably drop focus on close (`useReturnFocus` would fix it); a rapid second DELETE returns a 404 error alert; the whole-card link on the Categories page needs a visual check; `ApiError` in `client/src/lib/api.js` does not copy `details` from the response.
- `server/tests/routes/telegram.routes.test.js` failed `prettier --check` in the M5 handoff (existing, untouched).

### Ultrareview of PR #8 (M3): status unknown, no results recorded

- **What is on record [prior session]:** the M3 handoff (`git show e761103:HANDOFF.md`, line 9) says an Ultrareview of PR #8 was "launched, results not in yet", with the plan to check each finding against the code, fix the real ones with tests, run both suites and push to the branch.
- **GitHub [checked now]:** PR #8 (`feat/telegram-identity`) was merged on 2026-10-17 at 11:52 UTC with 0 reviews and 0 comments.
- **Not on record anywhere:** the Ultrareview findings, any decision about them, or any fix made for them. Whether the results ever arrived is unknown.
- **Do not confuse with:** commit `8e6eb86` "fix: address local review findings on M3", whose message refers to a local review. It was not checked whether that commit relates to the Ultrareview.
- **Next action for the owner:** say whether the results were received. Because PR #8 is already merged, any real finding now needs a new branch.

## 9. Working rules the owner has set in this session

- Plan first, wait for explicit approval of each phase or step. Do not start the next phase early.
- **Do not commit, push, create a PR, create or switch branches, rebase, merge or change the branch base without explicit approval.** Local commits only, one per approved step, never pushed.
- Do not edit `tasks/task.md` or other files outside the approved scope. Report changed files and exact verification results after each step.
- If a production-code fix seems needed during a test-only task, stop and explain first.
- CLAUDE.md ticket flow still applies when tickets exist: lint and tests before committing, `feat: <title> (#<issue>)` commits, no push, issues close when the milestone PR merges. For M6 there are no issues, so commits use a plain title.

## 10. Commands and startup notes

**Verified in this session**

- `npm run lint` (root), `npm test -w server`, `npm test -w client`. A single file: from `server/` or `client/`, `npx vitest run <path>` (add `-t "<name>"` for one test). Format check: `npx prettier --check <paths>` from the repo root.
- Server tests need no manual database: they use `mongodb-memory-server` as a replica set. Simulate a signed-in user with the `x-test-user: <user id>` header plus `Origin` and `X-Requested-With` on writes (pattern in `server/tests/routes/products.write.routes.test.js`).
- `gh issue list --state open`, `gh pr list --state all` (signed in as FatemehYafteh).

**From project files, not run this session (verify)**

- Dev stack: `npm run dev` from the root starts the database, the API on :4000 and the client on :5173. Seed: `npm run seed -w server` (adds what is missing) or `npm run seed:reset -w server`. Seed accounts, all with password `inventory-demo-2026`: `admin@example.com` (admin), `staff@example.com` (staff), `pending@example.com` (pending).
- Manual API check with `curl`: sign in with `POST /api/auth/login` using `-c admin.jar`, then reuse the cookie jar with `-b`. Send `Origin: http://localhost:5173` and `X-Requested-With` on writes. Try: list and filters as staff; `?archived=true` as staff (403) and admin; create with a duplicate SKU in another case (409), with `quantity` (400), with an inactive supplier (400); archive as staff (403) and admin, archive twice (409), restore.

**Environment gotchas**

- Windows with Git Bash. `python` is not installed; use `node` for scripted edits. Long shell heredocs and nested quoting in `node -e` break template literals; write code with the file tools.
- The shell working directory persists between commands. After `cd server`, root-level commands such as `npm run lint` fail. Use absolute paths or `cd` to the repo root each time.
- `console.log` inside Vitest tests can be swallowed; write measurements to a file instead.
- Temporary scratch files live in `$CLAUDE_JOB_DIR/tmp`, never in the repo.

## 11. Next steps

1. The owner reviews this file and answers the open questions in section 6 (sidebar impact, navy hex, D0 to D6 plan, A/B/C for this file).
2. On approval: create `feat/design-foundation` from `feat/products` (the working-tree state of this file decides how), add D0 to `tasks/task.md`, then do D1 to D6 one step at a time with an owner review and one local commit per step.
3. Then Phase 6.4, 6.5 and 6.6 on top of the design foundation, each with its own approval.
4. After M6: sort out section 2 (fetch, then decide rebase or merge), push, and open the milestone PRs in order (M5, then M6). Run `/mattpocock-skills:code-review` over the changes first if the owner wants it.

## 12. Resume prompt (copy this)

```text
Read HANDOFF.md at the repo root, then read docs/prds/06-products.md and tasks/task.md.
Do not change any code, run git commands that modify anything, or start any phase yet.
First verify the actual state: current branch, git status, git log --oneline -6, and
gh issue list --state open. Report where reality differs from the handoff.
Then summarise the open decisions in section 6 and wait for my approval before doing anything.
Rules: no commit, push, branch change, rebase or merge without my explicit approval.
```

---

## Appendix: previous handoff (M5, 2026-10-17), kept word for word

This was the uncommitted `HANDOFF.md` before this rewrite. It is historical: its statements about M5 progress, the branch and the test counts are **superseded** by sections 1 to 5 above. The M5 decisions (Q1 to Q11) are still current and live in `docs/plans/m5-categories-suppliers.md`.

<details>
<summary>Show the M5 handoff</summary>

# Handoff: M5 Categories and suppliers (2026-10-17)

This replaces the M3 handoff of 2026-10-14. Read it from git with `git show e761103:HANDOFF.md`.
Written at the end of the session. Everything marked **(verify)** was not checked at the time of writing.

## 1. Where things stand

- **Branch:** `feat/categories-suppliers`, local only, not pushed. Working tree was clean at the last commit `ec925fc`.
- **Base:** it was created from the local `feat/roles-approval` (M4 plus five docs commits, see 2). Three M5 commits sit on top of it.
- **Progress:** M5 tickets #15 and #16 are done and committed. #17 and #18 are not started. Nothing has been pushed, no PR is open for M5, and no issue is closed.

| Issue | Task | State | Commit |
|---|---|---|---|
| #15 M5: Categories API | 5.1 | Done | `59d27ea` |
| #16 M5: Categories page | 5.2 | Done, plus review fixes | `cee12d4`, `ec925fc` |
| #17 M5: Suppliers API | 5.3 | **Next**, blocked by #16 (now unblocked) | none |
| #18 M5: Suppliers page | 5.4 | Blocked by #17 | none |

`tasks/task.md` marks 5.1 and 5.2 as Done; 5.3 and 5.4 are still "To do".

## 2. Git state to sort out before opening a PR (verify)

- PR #14 (M4) shows as **MERGED** into `sub-prds` on GitHub, but the **local** `sub-prds` is 33 commits behind `origin/sub-prds` and does not contain M4.
- The local `feat/roles-approval` is **5 commits ahead** of `origin/feat/roles-approval`. Those five are the docs commits made at the start of the session (`3aefa90`, `9b76b04`, `e40a360`, `c5781a5`, `683e77a`: glossary, M5 plan, PRD updates). They are not on the remote, so they are not in the merged PR.
- `feat/categories-suppliers` contains those five plus the three M5 ticket commits.
- Likely plan: `git fetch`, then rebase or merge `feat/categories-suppliers` onto the updated `origin/sub-prds`, check that M4 arrived as expected (squash merges rewrite hashes, so a plain rebase may conflict), then push and open a PR. Decide this before running `implement-all.sh` or opening a PR. Nothing was done about it today.

## 3. What was decided (all in files, read these first)

- `docs/plans/m5-categories-suppliers.md`: the settled plan, decisions **Q1 to Q11**, assumptions A1 to A8, and unknowns. It is the source of truth.
- `docs/prds/05-categories-suppliers.md` and `docs/prds/PRD.md`: updated to match Q10.
- `GLOSSARY.md`: new section "Categories and suppliers" (Category, Supplier, Active supplier, Inactive supplier, Deactivate, Product count).

Key decisions in one line each:

- **Q1:** duplicate name gives 409 `DUPLICATE_NAME`, with a field-level message; case-insensitive.
- **Q2:** blocked delete gives 409 `IN_USE` with the count in the message; the UI disables Delete when the count is above 0 and still handles the 409.
- **Q3 (option C):** deletes run in a Mongo transaction in M5. **M6 must add a "touch" write** to the referenced Category (and Supplier) in product create and update, plus a concurrency test. Until M6, the delete-versus-assign race is not closed (harmless only because no products can be created yet).
- **Q4:** `GET /suppliers`: `active` omitted = all; search is a case-insensitive substring over name, contactPerson, phone and email; `sortBy` only `name`; `limit` default 20, max 100.
- **Q5:** inactive suppliers stay editable; deactivating one that has products is allowed.
- **Q6:** empty string clears optional fields; `email` validated only when non-empty; `phone` free text up to 40.
- **Q7:** cards and rows link to `/products?category=<id>` and `/products?supplier=<id>`. The Products page is M6, so those links reach the 404 page until then.
- **Q8:** four tickets as written, each API ticket with its server tests and each page ticket with its client tests. No seed change needed (checked).
- **Q10:** supplier delete is blocked by products **or stock movements**; the 409 `IN_USE` carries `details: { productCount, movementCount }`; the UI enables Delete only when both are zero.
- **Q11:** `AppError(status, code, message, errors, details)`; `details` is included in the body only when set. **Already implemented in #15** and used by categories; #17 reuses it.

## 4. What exists in the code now

- **Server (#15):** `categories.service.js`, `categories.controller.js`, `categories.routes.js`, `shared/schemas/categories.js`; `AppError` and `errorHandler` support `details`. The root `CLAUDE.md` error-class line was updated. Tests: `server/tests/routes/categories.routes.test.js` (18) and `server/tests/middleware/error.test.js` (3).
- **Client (#16):** `pages/CategoriesPage.jsx`, `lib/categories.js`, `components/categories/{CategoryCard,CategoryForm,DeleteCategoryDialog}.jsx`, `hooks/useReturnFocus.js`; the route and a "Categories" nav item for all active users. Tests: `pages/CategoriesPage.test.jsx` (21).
- **Reusable for #17/#18:** the `categories.service.js` pattern (grouped counts via aggregate, mapping Mongo error 11000 to `DUPLICATE_NAME`, transactional delete), `useReturnFocus` for any dialog opened from a plain button, `applyFieldErrors` and `errorMessage` in `lib/errors.js`.
- **Not yet carried by the client:** `ApiError` in `client/src/lib/api.js` does not copy `details` from the response. #18 needs `details` (counts) if it wants to read numbers rather than the message text; add `this.details = body?.details` there.

## 5. Verification at the last commit (`ec925fc`)

- Server: 27 files, **275 tests passed**.
- Client: 18 files, **160 tests passed**, but the run reports **10 unhandled jsdom `AggregateError`s**, so `npm test` (and therefore `implement-all.sh`) exits non-zero. I checked on the previous clean commit and it behaved the same, so it is not caused by M5. Cause not investigated.
- `npm run lint`: clean. Prettier check on the touched files: clean.
- `server/tests/routes/telegram.routes.test.js` fails `prettier --check`. Existing, untouched.
- Not run: a browser, `npm run dev`, `npm run seed`.

## 6. Known limitations and open items

- **Whole-card link not checked visually:** the stretched link with the admin buttons above it needs a manual look; jsdom cannot show whether a button click also navigates.
- **Same focus bug elsewhere:** M4's `RejectUserDialog` and `ChangeRoleDialog` open from plain buttons, so they almost certainly drop focus to `<body>` on close. `useReturnFocus` would fix them. Not touched (M4 scope).
- **Delete double-activation:** a rapid second DELETE would get a 404 and show an error alert. Low risk, unfixed.
- **Plan unknowns U2 to U4** (small): seed a category or supplier with only archived products (default no); whether the nav already had the items (it did not; added Categories); the M4 error shape (confirmed `{ message, code, errors }`, now also `details`).
- **Ticket #17 carries a note** that race protection for suppliers depends on M6.
- **M6 has no issue yet.** When it is written it needs: the touch write on Category and Supplier in product create and update, the concurrency test, and a Products page that accepts `?category=` and `?supplier=`.
- **Suppliers delete needs `StockMovement` counts** (`movementCount`, grouped count over `StockMovement.supplier`); check the `{ supplier: 1 }` index exists (the PRD lists one).

## 7. Next steps

1. Resolve section 2 (fetch, then decide rebase or merge onto `origin/sub-prds`). **(verify first)**
2. In a fresh session after `/clear`: `/mattpocock-skills:implement #17` (Suppliers API). Follow the `CLAUDE.md` ticket flow: TDD at the agreed seams, skip the per-ticket code-review step, run lint and tests, one commit titled `feat: M5: Suppliers API (#17)`, no push, no issue close.
3. Then `/mattpocock-skills:implement #18` (Suppliers page); read the "Not yet carried by the client" note above.
4. After #18: one fresh session runs `/mattpocock-skills:code-review` over all M5 changes, then push and open the milestone PR (the issues close on merge). Do the manual browser check of the cards and the supplier table first.
5. Consider fixing the 10 unhandled client errors so `npm test` exits cleanly.

## 8. Commands and startup notes

**Verified (run this session, or read from `package.json`, `CLAUDE.md` or the earlier handoff):**

- `npm run lint` (ran, clean).
- `npm test -w server` and `npm test -w client` (ran). Root `npm test` runs both workspaces.
- A single file: from `server/` or `client/`, `npx vitest run <path>` (ran). Format check: `npx prettier --check <paths>` from the repo root (ran).
- `gh issue view <n>`, `gh issue list --state open`, `gh pr list --state all` (ran, `gh` is signed in as FatemehYafteh).
- Branch and history: `git log --oneline`, `git status --short` (ran).

**From project files, not run today (verify before relying on them):**

- Dev stack: `npm run dev` from the root starts db, server and client (script in root `package.json`). Per the M3 handoff: API on :4000, client on :5173. Database alone: `npm run db:dev -w server`.
- Seed: `npm run seed -w server` (adds what is missing), `npm run seed:reset -w server` (wipe and reseed). Never in production. Seed edge cases already used by M5 tests: `Seasonal` and `Northwind Freight` are deletable, `Old Mill Paper Co.` is inactive but in use.
- Unattended run: `scripts/implement-all.sh [--base <ref>] [<issue>...]`, e.g. `scripts/implement-all.sh 17 18`. Needs a clean tree on a feature branch; it will fail on the client test exit code noted in section 5 (verify).

**Environment gotchas seen this session:**

- Windows with Git Bash. `python` is not installed; use `node` for scripted edits.
- Very long shell heredocs got cut off; write big files with the file tools instead.
- The server tests need no manual database: they use `mongodb-memory-server` as a replica set (read from `server/CLAUDE.md` and the test helpers).
- In server tests, simulate a signed-in user with the `x-test-user: <user id>` header plus `Origin` and `X-Requested-With` on writes (pattern in `server/tests/routes/categories.routes.test.js`).

## 9. Resume prompt (copy this)

```text
Read HANDOFF.md at the repo root, then read docs/plans/m5-categories-suppliers.md.
Do not change any code or run git commands that modify anything yet.
First verify the actual state: current branch, git status, git log --oneline -10,
git fetch and how this branch relates to origin/sub-prds (the M4 PR #14 shows as
merged), and gh issue list --state open. Report where reality differs from the handoff.
Then propose the next steps in order (resolving the branch situation, then issues
#17 and #18) and wait for my approval before doing anything.
```

</details>
