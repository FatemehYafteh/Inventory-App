# Launch checklist

Steps only a person can do before real users sign up. Sub-PRD 08 (acceptance criteria) requires the email checks below; they are **not** covered by automated tests, which use a fake mailer.

## 1. Email through Brevo (SMTP)

The server sends mail with Nodemailer over SMTP, configured only by environment variables. Nothing in the code is specific to Brevo.

1. In Brevo, add and verify the **sender** (or the whole sending domain) that `EMAIL_FROM` will use.
2. Create an **SMTP key** under *SMTP & API*. Use it as `SMTP_PASS`; never use the account password.
3. Set the production environment:

   | Variable | Value |
   |---|---|
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` (STARTTLS) or `465` (implicit TLS) |
   | `SMTP_USER` | the SMTP login shown in Brevo |
   | `SMTP_PASS` | the SMTP key |
   | `EMAIL_FROM` | `Inventory <no-reply@your-domain>` |
   | `APP_URL` | the public address of the app (it is used in email links) |

4. Start the server in production. It refuses to start if `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` or `EMAIL_FROM` is missing.

## 2. DNS for the sender domain

- [ ] **SPF**: the domain's TXT record includes Brevo (`include:spf.brevo.com`) and there is only one SPF record.
- [ ] **DKIM**: the DKIM record Brevo shows for the domain is published and Brevo reports it as verified.
- [ ] **DMARC** (recommended): a `_dmarc` TXT record exists, at least `v=DMARC1; p=none; rua=mailto:...`.

Check the records with Brevo's domain page and a tool such as `dig TXT your-domain`.

## 3. Real delivery check

Run these against the production (or staging) deployment with a real inbox you control, in both English and Persian:

- [ ] Register a new account: the verification email arrives, the link opens the app and verifies the address.
- [ ] Request a password reset: the email arrives and the link lets you set a new password.
- [ ] Resend verification: a new email arrives.
- [ ] The messages are not in spam, show the right sender name, and the links point to `APP_URL`.
- [ ] In the received message's headers, SPF and DKIM show `pass`.

Record the date and who checked it here: _not done yet_.

## 4. Other pre-launch checks

- [ ] `COOKIE_SECURE=true`, `TRUST_PROXY` set for the proxy in front of the API, `CLIENT_ORIGIN` and `APP_URL` are the real HTTPS address.
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are long random values, different from each other.
- [ ] `npm run seed` is not run in production (it refuses to).
- [ ] At least one admin exists (`ADMIN_EMAILS`, `ADMIN_TELEGRAM_IDS` or `npm run user:create -w server`).
- [ ] Exports open correctly in Excel: Persian text is readable and a cell such as `=SUM(A1)` shows as text.
