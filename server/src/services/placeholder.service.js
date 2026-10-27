import { EmailToken } from '../models/EmailToken.js';
import { User } from '../models/User.js';
import { revokeAllForUser } from './token.service.js';

/**
 * Absorbing a Placeholder user (inside the caller's transaction): deletes the user matching
 * `filter` together with its sessions and email tokens, and returns it (null when nothing
 * matched). Deleted first by the caller's flow because telegramId is unique, so it must leave
 * the Placeholder user before another account can take it.
 */
export async function deletePlaceholder(filter, session) {
  const removed = await User.findOneAndDelete(filter, { session });
  if (!removed) return null;
  await revokeAllForUser(removed._id, { session });
  await EmailToken.deleteMany({ user: removed._id }, { session });
  return removed;
}
