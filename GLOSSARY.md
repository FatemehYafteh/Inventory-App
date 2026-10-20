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

## Roles and approval

**Role**:
What a User may do once active: Admin or Staff. A rejected User keeps their Role, so reactivating them restores it.
_Avoid_: Permission level, user type

**Admin**:
A User who manages other Users' Status and Role, and can do everything Staff can.
_Avoid_: Superuser, owner

**Staff**:
A User who works with products and stock but cannot manage Users.
_Avoid_: Employee, regular user

**Status**:
Where a User stands with the admins: Pending (waiting), Active (approved) or Rejected (refused or removed).
_Avoid_: State, approval flag

**Approve**:
An Admin moving a Pending User to Active. Only a User with a Complete profile can be approved; reactivating a Rejected User to Active counts as approval.
_Avoid_: Accept, activate

**Reject**:
An Admin moving a Pending or Active User to Rejected, optionally with a reason. Any User can be rejected, including one with an incomplete profile.
_Avoid_: Ban, delete, deny

**Reactivate**:
An Admin moving a Rejected User back to Active or to Pending.
_Avoid_: Restore, unban

**Status change**:
One recorded move of a User's Status: who made it, when, from and to which Status, and the reason if given. The full list is the User's status history.
_Avoid_: Audit entry, log line

**Bootstrap admin**:
A User whose verified email or Telegram ID is on the admin lists in the environment. They become Admin and Active once, when their profile becomes complete; an Admin's later decision about them stands.
_Avoid_: Seed admin, superadmin

**Last active admin**:
The only User who is both Admin and Active. They can never be rejected or demoted, and nobody can reject or demote themselves.
_Avoid_: Final admin, root

## Categories and suppliers

**Category**:
A named group that every Product belongs to. Its title is unique.
_Avoid_: Type, department, tag

**Supplier**:
A company Products are sourced from, with contact details. A Product currently has at most one. Its name is unique.
_Avoid_: Vendor, manufacturer

**Active supplier**:
A Supplier that can be chosen for new Products.
_Avoid_: Enabled supplier

**Inactive supplier**:
A Supplier that cannot be chosen for new Products but stays on the Products that already have it.
_Avoid_: Disabled supplier, archived supplier

**Deactivate**:
An Admin turning an Active supplier into an Inactive one; reactivating reverses it. Used only for Suppliers, never for Users (those are Rejected).
_Avoid_: Disable, suspend, archive

**Product count**:
The number of Products, archived ones included, that use a Category or Supplier.
_Avoid_: Usage, item count
