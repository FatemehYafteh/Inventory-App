import { EmailSend } from '../models/EmailSend.js';
import { EmailToken } from '../models/EmailToken.js';
import { User } from '../models/User.js';
import { sendVerificationLink } from './auth.service.js';
import { isInCooldown } from './emailToken.service.js';

// Complete-profile emails (first + resends) per target address.
export const MAX_PROFILE_EMAILS_PER_ADDRESS = 5;
export const PROFILE_EMAIL_WINDOW_MS = 60 * 60 * 1000;

/**
 * Takes one of this hour's emails for the address. Records first and counts after, so
 * parallel requests can only err towards sending fewer.
 */
async function reserveProfileEmail(email) {
  const send = await EmailSend.create({ email });
  const sentThisHour = await EmailSend.countDocuments({
    email,
    createdAt: { $gt: new Date(Date.now() - PROFILE_EMAIL_WINDOW_MS) },
  });
  if (sentThisHour <= MAX_PROFILE_EMAILS_PER_ADDRESS) return true;
  await EmailSend.deleteOne({ _id: send._id });
  return false;
}

/**
 * Emails the link for the user's `pendingEmail` ("Resend" on Check your email), unless one
 * went out within the 60 s cooldown or the address has had its emails for this hour. Nothing
 * is sent when another User holds the address (cases 2 and 3, and rejected owners, are
 * handled separately).
 */
export async function resendProfileEmail(user, deps) {
  const email = user.pendingEmail;
  if (!email) return;
  if (await isInCooldown(user._id, 'verify_email')) return;
  if (await User.exists({ email, _id: { $ne: user._id } })) return;
  if (!(await reserveProfileEmail(email))) return;
  await sendVerificationLink(user, email, deps);
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
      type: { $in: ['verify_email', 'link_telegram'] },
      usedAt: null,
    });
  }
  user.name = name;
  user.pendingEmail = email;
  await user.save();
  await resendProfileEmail(user, deps);
}
