import { User } from '../models/User.js';

// A complete profile: a name and a verified email (see isProfileComplete).
const COMPLETE_PROFILE = { name: { $exists: true, $ne: '' }, emailVerified: true };

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterFor({ status, search, incomplete }) {
  const filter = {};
  if (status) filter.status = status;
  // The Pending tab is the approval queue: only complete profiles, unless the unfinished
  // signups were asked for.
  if (status === 'pending') {
    if (incomplete) filter.$nor = [COMPLETE_PROFILE];
    else Object.assign(filter, COMPLETE_PROFILE);
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { telegramUsername: pattern }];
  }
  return filter;
}

/**
 * One page of users for the Users page. Pending: oldest signup first (first in, first out);
 * everything else by name.
 */
export async function listUsers(query) {
  const { page, limit, status } = query;
  const filter = filterFor(query);
  const sort = status === 'pending' ? { createdAt: 1, _id: 1 } : { name: 1, _id: 1 };

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('+passwordHash')
      .collation({ locale: 'en', strength: 2 })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return { users, total, page, limit };
}

/** How many complete profiles wait for approval (the badge in the navigation). */
export function pendingCount() {
  return User.countDocuments({ status: 'pending', ...COMPLETE_PROFILE });
}
