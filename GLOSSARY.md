# Product Inventory Manager

A web app where approved staff track products, suppliers and stock levels. Each person has exactly one account and can sign in to it with Telegram, with email and password, or both.

## Accounts and sign-in

**User**:
One person's single account in the app, holding their role, status and history.
_Avoid_: Account holder, member, duplicate account

**Sign-in method**:
A way a User proves who they are: a Telegram identity, or a verified email plus password. A User holds one or both.
_Avoid_: Identity provider, login type

**Placeholder user**:
A User created by a Telegram sign-in who has not yet verified an email. It cannot use the app and has no history.
_Avoid_: Temporary user, stub account, Telegram user

**Complete profile**:
A User whose name is set and whose email is verified. Only then can an admin approve them.
_Avoid_: Onboarded, registered

**Connect Telegram**:
A signed-in User adding a Telegram identity to their own account, proven with a one-time code.
_Avoid_: Link Telegram, pair, bind

**Account link**:
Moving a Placeholder user's Telegram identity into an existing User, confirmed with that User's password; the Placeholder user is then deleted.
_Avoid_: Merge, Connect Telegram

**One-time code**:
The six-digit code the Telegram bot sends to prove the person controls that Telegram account.
_Avoid_: PIN, password, token
