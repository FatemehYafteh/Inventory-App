import { m } from '@inventory/shared/errorCodes';
import mongoose from 'mongoose';
import { EmailToken } from '../models/EmailToken.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { hashToken } from '../utils/crypto.js';
import { checkPasswordWithLock } from './auth.service.js';
import { consumeEmailToken } from './emailToken.service.js';
import { applyAdminBootstrap } from './adminBootstrap.service.js';
import { deletePlaceholder } from './placeholder.service.js';

function invalidLink() {
  return new AppError(400, 'INVALID_TOKEN', m.LINK_INVALID_OR_EXPIRED);
}

function wrongPassword() {
  const message = m.PASSWORD_INCORRECT;
  return new AppError(401, 'INVALID_PASSWORD', message, { password: message });
}

// Still true since the link was sent: the Placeholder user waits on this email, and the
// owner holds it with no Telegram account and is not rejected.
const placeholderFilter = (linkToken) => ({
  _id: linkToken.user,
  pendingEmail: linkToken.email,
  emailVerified: false,
  telegramId: { $exists: true },
});
const ownerFilter = (linkToken) => ({
  _id: linkToken.targetUser,
  email: linkToken.email,
  telegramId: { $exists: false },
  status: { $ne: 'rejected' },
});

/**
 * Confirm link (Account link, case 2). The owner's password is checked like an email login:
 * a wrong one counts toward the login lock, a locked account is refused, and the link stays
 * usable until it expires. Then, in one transaction, the Placeholder user's Telegram identity
 * moves to the owner's account (whose email becomes verified), and the Placeholder user is
 * deleted with its sessions and email tokens. Signs no one in.
 */
export async function confirmAccountLink({ token, password }, config) {
  const linkToken = await EmailToken.findOne({
    tokenHash: hashToken(token, config.jwt.refreshSecret),
    type: 'link_telegram',
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!linkToken) throw invalidLink();
  const [placeholder, owner] = await Promise.all([
    User.exists(placeholderFilter(linkToken)),
    User.findOne(ownerFilter(linkToken)).select('+passwordHash'),
  ]);
  if (!placeholder || !owner?.passwordHash) throw invalidLink();

  if (!(await checkPasswordWithLock(owner, password))) throw wrongPassword();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await consumeEmailToken({ token, type: 'link_telegram', session }, config);
      const removed = await deletePlaceholder(placeholderFilter(linkToken), session);
      if (!removed) throw invalidLink();

      const telegram = { telegramId: removed.telegramId };
      if (removed.telegramUsername) telegram.telegramUsername = removed.telegramUsername;
      // Also unchanged since the password check: no reset and no lock in between.
      const linked = await User.findOneAndUpdate(
        {
          ...ownerFilter(linkToken),
          passwordHash: owner.passwordHash,
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }],
        },
        {
          $set: { ...telegram, emailVerified: true, failedLoginCount: 0 },
          $unset: { lockedUntil: 1 },
        },
        { session },
      );
      if (!linked) throw invalidLink();
      await applyAdminBootstrap(linked._id, config, { session });
    });
  } finally {
    await session.endSession();
  }
}
