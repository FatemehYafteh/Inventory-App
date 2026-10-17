import mongoose from 'mongoose';

export const ROLES = ['admin', 'staff'];
export const STATUSES = ['pending', 'active', 'rejected'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    pendingEmail: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    telegramId: { type: String, unique: true, sparse: true },
    telegramUsername: { type: String, trim: true },
    role: { type: String, enum: ROLES, default: 'staff' },
    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statusChangedAt: Date,
    statusReason: { type: String, trim: true, maxlength: 500 },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    // Access tokens issued before this second are refused (set by a password reset).
    sessionsRevokedAt: Date,
  },
  { timestamps: true },
);

export const User = mongoose.model('User', userSchema);

/** A usable profile: a name and a verified email (Telegram signups start without both). */
export function isProfileComplete(user) {
  return Boolean(user.name && user.emailVerified);
}

/** A Telegram signup that has not verified an email yet: no history, cannot use the app. */
export function isPlaceholder(user) {
  return Boolean(user.telegramId && !user.emailVerified);
}
