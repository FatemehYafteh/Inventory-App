# Phase T: dark mode browser pass (T.2)

Written 2026-10-31 on branch `feat/theme-switching`. The `.dark` token set had never been rendered; this pass forces it on every page before the toggle exists to users.

## Method

- Headless Chrome driven over the DevTools protocol, against the local API and a seeded database. The Telegram bot was kept off.
- Dark was forced by saving `theme=dark` in `localStorage`, so the pre-paint script in `index.html` was exercised too. Every page reported `html.dark` and `color-scheme: dark`.
- **Pages:** all signed-in and signed-out pages, as admin, staff and pending (Rhea Stone, a genuinely pending seed account), plus the login, register, forgot-password, reset-password, verify-email, confirm-link and not-found screens signed out.
- **Widths:** 360, 768, 1024 and 1280 px. **Languages:** English (LTR) and Persian (RTL). 152 page renders in all.
- **Automatic checks on each render:** every visible text element against its effective background (4.5:1, or 3:1 for large text), and horizontal page overflow. The scanner was proved against a deliberately low-contrast element before its zero results were trusted.
- **Interactive states (admin, English, 1280 and 360):** Add product sheet, category select menu, Adjust stock, Stock history and Edit dialogs, Archive confirm, product combobox, date-range popover, Reject dialog, Users tabs, Add category, Delete confirm, Add supplier, the mobile menu `Sheet`, the Telegram tab, a login error alert and register validation errors.
- Every screenshot was also looked at, because contrast numbers cannot show a missing edge or an invisible border.
- **Not covered:** a rejected user's screens (rejected accounts cannot sign in, so they only see the login error, which was covered), toasts (none can be triggered without changing stock data), and the user detail drawer (the automated click missed it; it uses the same sheet tokens as the Add product sheet).

## Result

No text failed contrast on any page or in any interactive state, in either language, and no page gained overflow in dark that it did not have in light. The token set, status badges, tables, forms, dialogs, popovers, calendar, alerts and focus rings all read correctly.

## Dark defects found

| # | Defect | Fix |
|---|---|---|
| 1 | The navy sidebar, mobile top bar and minimal bar (`--sidebar` `#0B1426`) are visually identical to the page (`--background` `#0B1220`) in dark, so the navigation loses its edge. | T.3: a dark-only separator using `--sidebar-accent`. No token changes. |

## Not dark-specific (follow-up list)

These look the same in light mode, so they are outside this phase.

1. The pending user's Profile page overflows sideways at 360 px (398 px of content in English, 364 in Persian). The minimal bar is too wide for the back link, language switcher and Log out button. T.4 adds a theme switcher to this bar, so it keeps that bar from getting worse.
2. On the Persian dashboard at 1280 px the inventory-value figure is wider than its card and is clipped at the card edge.
3. The Products table shows an empty "Archived" column between Title and Category for admins.
4. `ring-ring/50` in four page-level files and `placeholder:text-muted-foreground` in `ui/command.jsx` (the known follow-ups in `docs/design-system.md`) were not seen to fail in dark. They are unchanged.
