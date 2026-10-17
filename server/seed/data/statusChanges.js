// One row per status change the seed users went through, replayed after the users exist.
// `user` and `changedBy` are user keys from users.js; `changedBy: null` is the system (the
// admin bootstrap). Each user's last row ends at their current status.
export const statusChanges = [
  // Listed in the admin list: promoted when the profile was complete.
  { user: 'telegramAdmin', from: 'pending', to: 'active', changedBy: null },
  {
    user: 'rejected',
    from: 'pending',
    to: 'rejected',
    changedBy: 'admin',
    reason: 'Not part of the warehouse team.',
  },
  {
    user: 'telegramRejected',
    from: 'pending',
    to: 'rejected',
    changedBy: 'admin',
    reason: 'Signed up by mistake.',
  },
];
