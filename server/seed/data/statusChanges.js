import { users } from './users.js';

// One row per status change the seed users went through, replayed after the users exist.
// `user` and `changedBy` are user keys from users.js; `changedBy: null` is the system (the
// admin bootstrap). `daysAgo` is how long before the seed runs the change happened. Each
// user's rows are in order and the last one ends at their current status.
const handwritten = [
  // Listed in the admin list: promoted when the profile was complete.
  { user: 'telegramAdmin', from: 'pending', to: 'active', changedBy: null, daysAgo: 60 },
  {
    user: 'rejected',
    from: 'pending',
    to: 'rejected',
    changedBy: 'admin',
    reason: 'Not part of the warehouse team.',
    daysAgo: 2,
  },
  {
    user: 'telegramRejected',
    from: 'pending',
    to: 'rejected',
    changedBy: 'admin',
    reason: 'Signed up by mistake.',
    daysAgo: 2,
  },
  // Rejected, then let back in.
  {
    user: 'reactivated',
    from: 'pending',
    to: 'rejected',
    changedBy: 'admin',
    reason: 'Signed up with the wrong team.',
    daysAgo: 9,
  },
  { user: 'reactivated', from: 'rejected', to: 'active', changedBy: 'admin', daysAgo: 2 },
];

// Everyone approved by an admin has the pending to active change that did it.
const approvals = users
  .filter((user) => user.approvedBy)
  .map((user) => ({
    user: user.key,
    from: 'pending',
    to: 'active',
    changedBy: user.approvedBy,
    daysAgo: user.signedUpDaysAgo - 1,
  }));

// Rejected users with a reason (the handwritten ones above cover the two older seed users).
const rejections = users
  .filter((user) => user.key.startsWith('rejectedStaff'))
  .map((user) => ({
    user: user.key,
    from: 'pending',
    to: 'rejected',
    changedBy: user.statusChangedBy,
    reason: user.statusReason,
    daysAgo: user.signedUpDaysAgo - 1,
  }));

export const statusChanges = [...handwritten, ...approvals, ...rejections];
