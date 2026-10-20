# Design system

How the client looks and why. Built in the Design Foundation phase (D0 to D6); the layout is a navy sidebar with a light main area. UI only: nothing here changes the API, auth, permissions or validation.

## Principles

- **Tokens only.** Colour comes from the design tokens in `client/src/index.css`. Components never use hex values or palette utilities (`bg-white`, `text-white`, `emerald-*`, `bg-black/50`).
- **Text always accompanies colour.** A status is shown with its words, never by colour alone (stock status, user status, errors).
- **Contrast is enforced, not hoped for.** Text needs 4.5:1 against the surface it sits on, and field borders and focus rings need 3:1. `client/src/styles/tokens.test.js` checks every pair in both themes, and `components/ui/ui.test.jsx` guards the token migrations.
- **Light only for now.** The `.dark` token set exists, but nothing applies the `.dark` class. Theme switching and a saved preference are phase T, planned separately.

## Source of truth

`client/src/index.css` holds the tokens as hex values in `:root` (light) and `.dark` (dark), and maps them to Tailwind utilities in `@theme inline`. This document names roles, not values, so it cannot drift from the code. Read the values in `index.css`; read the rules here.

## Token roles

Use the utility form (`bg-card`, `text-muted-foreground`, `border-input`, ...). Each token below also has a `-foreground` partner where text sits on it.

| Token | Use it for | Do not |
|---|---|---|
| `--background`, `--foreground` | The page and its body text. | Put text on `--background` that is not `--foreground` or `--muted-foreground`. |
| `--card`, `--card-foreground` | Cards, panels, table containers. | |
| `--popover`, `--popover-foreground` | Menus, selects, popovers, toasts. | |
| `--primary`, `--primary-foreground` | Fills: buttons, filled badges, selected days. | Use `--primary` as a text colour. |
| `--primary-hover` | The hover fill of a primary button. | |
| `--primary-text` | Blue text such as links. It is lighter in dark mode so it stays readable. | Use `text-primary`. |
| `--secondary`, `--secondary-foreground`, `--muted`, `--accent`, `--accent-foreground` | Quiet fills, selected and hover rows, tab lists, and the text on them. | |
| `--muted-foreground` | Secondary text, descriptions, captions. | |
| `--destructive`, `--destructive-foreground` | The solid destructive fill and its text. | Use `text-destructive` for text. |
| `--danger`, `--danger-soft` | Error text and its tinted fill: field errors, `FormAlert`, danger badges. | |
| `--success`, `--success-soft` | Success text and its tinted fill. | |
| `--warning`, `--warning-soft` | Warning text and its tinted fill. | |
| `--neutral`, `--neutral-soft` | Quiet status text and fill. No component uses them yet; `Badge` has no neutral variant, so inactive and archived use the outline badge. | |
| `--border` | Decorative dividers and card edges. | Use it for a field border. |
| `--input` | The border of a field (input, select, OTP slot). It meets 3:1. | |
| `--placeholder` | Placeholder text in fields. | Use `--muted-foreground` for placeholders. |
| `--ring` | Focus rings on the light surface, at full strength. | Use `ring-ring/50`: the half-strength ring fails 3:1. |
| `--overlay` | The dimmed backdrop behind dialogs and sheets (`bg-overlay`). | Use `bg-black/50`. |
| `--sidebar`, `--sidebar-foreground` | The navy surface and its text. | |
| `--sidebar-muted` | Secondary text on navy, such as the user name. | |
| `--sidebar-accent`, `--sidebar-accent-foreground` | Hover and active nav items on navy. | |
| `--sidebar-ring` | Focus rings on navy. The page ring is too faint there. | |

## Typography and shape

- `--font-sans` is the system font stack, so no font files load.
- Table cells use tabular numbers (a base rule on `td` and `th`), so quantities line up.
- `--radius` is `0.5rem`. The `sm`, `md`, `lg` and `xl` radii derive from it.

## Components

- **`Badge`** (`ui/badge.jsx`): variants `default`, `secondary`, `destructive`, `outline`, and the soft status variants `success`, `warning` and `danger`.
- **`StatusBadge`** (`components/StatusBadge.jsx`): maps a status name to a badge, always with text. An unknown status shows as is, in the outline style. A `label` prop keeps the stored text (the Users page shows the lower-case value).

  | Status | Badge variant |
  |---|---|
  | `active`, `in_stock` | `success` |
  | `pending`, `low_stock` | `warning` |
  | `rejected`, `out_of_stock` | `danger` |
  | `inactive`, `archived`, anything else | `outline` |

- **`PageHeader`** (`layout/PageHeader.jsx`): the page's level-1 heading, with an optional description and an `actions` slot that wraps on narrow screens. Its ref goes to the `<h1>`, which tests and `useReturnFocus` use to put focus back after a dialog closes.
- **Settings-style pages** (Profile): a `PageHeader`, then one `Card` per section in a left-aligned `max-w-3xl` column with `gap-6`. Section titles are `<h2 class="text-lg font-semibold">` (`CardTitle` is an `<h1>`), each with a one-line muted description. A section is a named region (`<section aria-labelledby>`) unless its title would repeat its field label, as with Name.
- **Profile layout** (D8): an identity card (initials avatar, name, email, role and status badges), then from `lg` two columns (Name and Password on the left, Sign-in methods in a 22rem column on the right) in a `max-w-5xl` container; one column below `lg`. Every user-supplied string (name, email, Telegram username) uses `[overflow-wrap:anywhere]` inside a `min-w-0` parent so long values wrap instead of overflowing.
- **`FormAlert`**: `error` (role `alert`) and `success` (role `status`) tones on the danger and success tokens. Field errors in `TextField` use `text-danger`.
- **Button**: the default variant hovers to `--primary-hover`. Every control uses a full-strength focus ring.
- **Overlays, menus and toasts** read `--overlay`, `--popover` and the status tokens, so they follow the theme.
- **`components/ui/`**: shadcn components. D2 deliberately hand-edited them onto the tokens, so keep them token-only and do not paste fresh generated code over them without redoing that.

## Layout and responsive rules

- **Shell** (`layout/AppLayout.jsx`, `SidebarNav.jsx`): from `lg` (1024px) a fixed 15rem navy sidebar; below that a navy top bar whose menu opens the same navigation in a `Sheet`. Log out and the user link live only in the sidebar footer or the menu.
- **Skip link:** the first focusable element, jumping to `main#main`. It covers the menu button while focused, by design.
- **One `Main` navigation** is exposed at a time: the hidden sidebar is `display:none` below `lg`.
- **`MinimalLayout`** (pending users and Profile): the navy bar without app navigation.
- **Card grids** use container queries (`@container` on the page section, then `@lg:grid-cols-2` and `@3xl:grid-cols-3`), so the columns follow the content width, not the screen.
- **Wide tables** scroll inside their card. The page itself must never scroll sideways.

## Accessibility rules

- Focus rings are full strength: `ring-ring` on the light surface, `ring-sidebar-ring` on navy.
- Keyboard users get the skip link, focusable dialogs and a focus-return target (`PageHeader`'s heading).
- Icons that decorate text are `aria-hidden`; the text stays.
- Status badges, alerts and field errors always include words.

## Known follow-ups

- Four page-level files still use the faint `ring-ring/50` (about 2.1:1): `DataTableColumnHeader`, `DataTablePagination`, `SupplierTable` and `UsersTable`.
- `ui/command.jsx` still uses `placeholder:text-muted-foreground`.
- The close button on the mobile menu keeps the page ring, which is 3.19:1 on navy (above 3:1, with little margin).
- Observed in the browser pass (D5): wide tables, such as Users on its Rejected tab, scroll inside their card even at 1280px; the Suppliers search placeholder is clipped at 360px.
- `AwaitingApprovalPage` still uses `CardTitle` (an `<h1>`) as its heading instead of `PageHeader`.
- Dark mode is untested in a browser, because nothing applies it yet.

## Changing a token

1. Edit the token in **both** `:root` and `.dark` in `client/src/index.css`.
2. If it is new, map it in `@theme inline` so the utility exists.
3. Add or update its contrast pair in `client/src/styles/tokens.test.js`.
4. Run the client suite: a token missing from either theme, or a failing pair, fails it.
5. Update this document if a role changed.
