# Phase L: Persian text review

The Persian texts were drafted by the assistant, not by a native reviewer. This page records what was checked automatically, the terms used, and the few choices that need the owner's judgment. Final proofreading is the owner's.

## 1. Where the Persian texts are

| Files | Content |
|---|---|
| `client/src/i18n/locales/fa/*.json` | All UI texts, one file per area: `common`, `layout`, `table`, `auth`, `profile`, `products`, `users`, `categories`, `suppliers`, `language`, `errors` (validation and API error messages, one entry per catalogue code) |
| `server/src/i18n/fa.js` | The six account emails (subject, text, HTML pieces) and the Telegram bot messages (start replies, sign-in code, approval notices) |

About 610 client strings plus the server copy. English is the fallback for anything missing, and a test fails if a key exists in one language and not the other.

## 2. Checked automatically (2026-10-21)

Run over every Persian string in the files above:

| Check | Result |
|---|---|
| Arabic letter forms (ي, ك) instead of Persian (ی, ک) | none |
| Arabic-Indic digits (٠-٩) instead of Persian (۰-۹) | none |
| Missing half-space (ZWNJ): `می ` + verb, `نمی `, a space before ها/های | none |
| Spelling `تامین` without the hamza (should be `تأمین`) | none |
| Mixed terms (گذرواژه, پسورد, اکانت, پست الکترونیک) | none; one term per concept |
| Same words in Persian and English files | none (all texts differ) |
| `{{placeholders}}` and markup tags equal in both languages | enforced by `client/src/i18n/locales.test.js` |
| Latin words left inside Persian text | only: `Inventory` (the brand), `SKU`, `Start` (Telegram's own button), and API values (`JSON`, `asc`, `desc`) |
| The Telegram button label quoted by the bot equals the client's | yes: «ادامه با تلگرام» in both |
| Log-in wording | «ورود» for the action and buttons, «وارد شوید» inside sentences, in the client, the emails and the bot |
| Reset and set password wording | «بازنشانی رمز عبور» (reset) and «تعیین رمز عبور» (set), the same in the client and the emails |

## 3. Terms used

| English | Persian |
|---|---|
| Product / Products | محصول / محصولات |
| Category / Categories | دسته‌بندی / دسته‌بندی‌ها |
| Supplier / Suppliers | تأمین‌کننده / تأمین‌کنندگان |
| Stock / Quantity | موجودی / تعداد |
| Receive / Ship / Adjust | دریافت / ارسال / اصلاح |
| Low stock / Out of stock / In stock | موجودی کم / ناموجود / موجود |
| Archive / Restore | بایگانی / بازیابی |
| Admin / Staff | مدیر / کارمند |
| Active / Pending / Rejected | فعال / در انتظار / ردشده |
| Account | حساب کاربری |
| Email / Password | ایمیل / رمز عبور |
| Log in / Log out | ورود / خروج |
| Telegram | تلگرام |
| Reorder level | حد سفارش |

## 4. Choices that need the owner

These are judgment calls, not errors. None blocks the merge.

1. **«ردشده» (Rejected status).** Written as one word. «رد شده» (two words) is also common and may read more naturally in a badge.
2. **«ارسال» for Ship.** It is also the word for "send" («ارسال پیوند» = send link). Context makes it clear, but «خروج کالا» (goods out) or «ارسال کالا» would be unambiguous for the stock action. Receive is «دریافت».
3. **«اصلاح» for Adjust.** Literally "correct". «تعدیل» is the usual accounting word for a stock adjustment and may suit warehouse staff better.
4. **Currency.** Prices still show US dollars (`$`) with Persian digits, as in English. The PRD names no currency, and the symbol is changed in one place (`client/src/lib/format.js`).
5. **The brand.** `Inventory` and `Inventory Manager` stay in Latin in the UI, emails and bot. Say if you want a Persian brand name.
6. **Tone.** Formal, polite plural address («کنید», «شما»). Say if you prefer a more informal tone.

## 5. How to review

1. Open the app, switch the header switcher to فارسی, and walk through Dashboard, Products, Categories, Suppliers, Users, Profile, and the sign-in and registration pages.
2. Send yourself the account emails: register, request a password reset, and approve or reject a test user. With no SMTP configured in development, `mail.service` logs each email and its links instead of sending it.
3. Press Start in the Telegram bot with a Persian-language account to see the bot copy.
4. Edit the JSON or `fa.js` files directly. Tests will tell you if a key or placeholder goes missing.
