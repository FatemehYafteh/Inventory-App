import { EmailSend } from '../models/EmailSend.js';
import { EmailToken } from '../models/EmailToken.js';
import { User } from '../models/User.js';
import { sendVerificationLink } from './auth.service.js';
import { RESEND_COOLDOWN_MS, issueEmailToken } from './emailToken.service.js';
import { accountLinkTemplate, telegramConflictTemplate } from './mail.templates.js';

// Complete-profile emails (first + resends) per target address.
export const MAX_PROFILE_EMAILS_PER_ADDRESS = 5;
export const PROFILE_EMAIL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Takes one of this hour's emails for the address. False within 60 s of this user's last
 * email to the same address (a new address may be sent to at once), or when the address has
 * had its emails for the hour. Records first and counts after, so parallel requests can only
 * err towards sending fewer.
 */
async function reserveProfileEmail(user, email) {
  const recent = await EmailSend.exists({
    user: user._id,
    email,
    superseded: false,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
  });
  if (recent) return false;

  const send = await EmailSend.create({ user: user._id, email });
  const sentThisHour = await EmailSend.countDocuments({
    email,
    createdAt: { $gt: new Date(Date.now() - PROFILE_EMAIL_WINDOW_MS) },
  });
  if (sentThisHour <= MAX_PROFILE_EMAILS_PER_ADDRESS) return true;
  await EmailSend.deleteOne({ _id: send._id });
  return false;
}

// Links sent for Complete profile; a new email invalidates the unused ones.
const PROFILE_TOKEN_TYPES = ['verify_email', 'link_telegram'];

/**
 * What the address gets, by who holds it:
 * - nobody (case 1): a verification link;
 * - an email + password account without Telegram, not rejected (case 2): a link confirmation;
 * - an account with a different Telegram account (case 3): a notice, and nothing is linked;
 * - a rejected account, or one with no way to confirm: nothing.
 */
function profileEmailFor(owner) {
  if (!owner) return 'verify';
  if (owner.status === 'rejected') return null;
  if (owner.telegramId) return 'conflict';
  if (owner.passwordHash) return 'link';
  return null;
}

async function sendLinkConfirmation(user, owner, { config, mailer }) {
  const token = await issueEmailToken(
    { userId: user._id, type: 'link_telegram', email: owner.email, targetUser: owner._id },
    config,
  );
  const link = `${config.appUrl}/confirm-link?token=${encodeURIComponent(token)}`;
  const telegram = { name: user.name, username: user.telegramUsername };
  mailer.sendInBackground({
    to: owner.email,
    ...accountLinkTemplate({ name: owner.name, telegram, link }),
  });
}

function sendConflictNotice(user, owner, { mailer }) {
  const telegram = { name: user.name, username: user.telegramUsername };
  mailer.sendInBackground({
    to: owner.email,
    ...telegramConflictTemplate({ name: owner.name, telegram }),
  });
}

/**
 * Sends the Complete-profile email for the user's `pendingEmail` ("Resend" on Check your
 * email), unless one went to that address within the 60 s cooldown or the address has had
 * its emails for this hour. The caller never learns which case applied.
 */
export async function resendProfileEmail(user, deps) {
  const email = user.pendingEmail;
  if (!email) return;

  const owner = await User.findOne({ email, _id: { $ne: user._id } }).select('+passwordHash');
  const kind = profileEmailFor(owner);
  if (!kind) return;
  if (!(await reserveProfileEmail(user, email))) return;

  if (kind === 'verify') await sendVerificationLink(user, email, deps);
  else if (kind === 'link') await sendLinkConfirmation(user, owner, deps);
  else sendConflictNotice(user, owner, deps);
}

/**
 * Complete profile: saves the name and the email to verify, then sends the link. A new
 * email replaces the old one, and every unused link sent for an earlier email stops working.
 * The caller always gets the same response.
 */
export async function completeProfile(user, { name, email }, deps) {
  if (user.pendingEmail !== email) {
    await EmailToken.deleteMany({
      user: user._id,
      type: { $in: PROFILE_TOKEN_TYPES },
      usedAt: null,
    });
    // Their links are dead, so going back to an earlier address is not a resend.
    await EmailSend.updateMany({ user: user._id }, { $set: { superseded: true } });
  }
  user.name = name;
  user.pendingEmail = email;
  await user.save();
  await resendProfileEmail(user, deps);
}

/** Profile page: renames a signed-in user with a complete profile. Returns the user. */
export async function updateName(user, { name, language }) {
  if (name !== undefined) user.name = name;
  if (language !== undefined) user.language = language;
  await user.save();
  return user;
}
