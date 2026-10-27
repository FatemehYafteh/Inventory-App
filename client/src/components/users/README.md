# components/users

Admin user management from sub-PRD 04: the users table, status and role actions, and the detail drawer.

- `UsersTable`: the table and its row actions (Approve, Reject, Reactivate, Make admin/staff); the name opens the drawer.
- `UserDrawer`: one user's profile and status history (newest first), open while `?user=<id>` is in the URL.
- `RejectUserDialog`, `ChangeRoleDialog`: the reason prompt and the role confirmation.
- `userDisplay`: the cells and date helpers shared by the table and the drawer.
