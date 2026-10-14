import mongoose from 'mongoose';

export const AUTH_REQUEST_PURPOSES = ['login', 'connect'];
export const AUTH_REQUEST_STATUSES = [
  'pending',
  'otp_sent',
  'verified',
  'refused',
  'rate_limited',
  'expired',
];

/** One Telegram sign-in attempt, from Continue with Telegram to a verified code. */
const authRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    purpose: { type: String, enum: AUTH_REQUEST_PURPOSES, default: 'login' },
    connectUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startTokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: AUTH_REQUEST_STATUSES, default: 'pending' },
    telegramId: String,
    telegramUsername: String,
    name: String,
    otpHash: String,
    otpExpiresAt: Date,
    attempts: { type: Number, default: 0 },
    lastSentAt: Date,
    sendCount: { type: Number, default: 0 },
    ip: String,
    userAgent: String,
    // The request stops working at expiresAt; the document stays an hour so code sends
    // can be counted per Telegram ID.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

authRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });
authRequestSchema.index({ telegramId: 1, createdAt: 1 });

export const AuthRequest = mongoose.model('AuthRequest', authRequestSchema);
