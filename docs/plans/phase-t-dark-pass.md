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
| 1 | The navy sidebar, mobile top bar and minimal bar (`--sidebar` `#0B1426`) are visually identical to the page (`--background` `#0B1220`) in dark, so the navigation loses its edge. | Fixed in T.3: a 1px dark-only edge using `--sidebar-accent` on the sidebar, the mobile top bar and the minimal bar. No token changes. Checked in the browser: light computes to no border, dark to 1px. |

## Final pass (T.5), with the finished code

The same pass was run again after T.4, in both themes: 152 renders each (4 roles, 4 widths, 2 languages), light and dark, with no overflow and no contrast failures. The real switcher was also driven in the browser (login, pending Profile and the app, at 360, 768 and 1280 px, English and Persian): clicking an option flips `html.dark`, `color-scheme`, `localStorage` and the `theme-color` meta together; the sidebar and the open mobile menu stay in step; the keyboard focus ring shows on the switcher in dark.

Found and fixed while doing this: the sidebar and the mobile menu can be in the page at once, and radios with the same `name` form one group across the document, so each `ThemeSwitcher` now names its own group (`useId`), with a test.

One light-mode change, caused by the new control: the minimal bar now wraps its controls onto a second line on a narrow screen. Before, it overflowed sideways at 360 px (follow-up 1 below), and a third control would have made that worse. At 768 px and wider the bar looks as before.

## Not dark-specific (follow-up list)

These look the same in light mode, so they are outside this phase.

1. **Fixed in T.4.** The pending user's Profile page overflowed sideways at 360 px (398 px of content in English, 364 in Persian) because the minimal bar was too wide for its controls. The bar now wraps.
2. On the dashboard at 1280 px the inventory-value figure is wider than its card and spills past its edge, in English and in Persian.
3. The Products table shows an empty "Archived" column between Title and Category for admins.
4. `ring-ring/50` in four page-level files and `placeholder:text-muted-foreground` in `ui/command.jsx` (the known follow-ups in `docs/design-system.md`) were not seen to fail in dark. They are unchanged.
