import mongoose from 'mongoose';

/**
 * One email sent to an address by the Complete profile flow (verify link, link confirmation,
 * case 3 notice). Kept for an hour to enforce the per-address limit and the 60 s resend
 * cooldown, then removed by TTL.
 */
const emailSendSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    // The Placeholder user whose Complete profile sent it.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailSendSchema.index({ email: 1, createdAt: 1 });
emailSendSchema.index({ user: 1, email: 1, createdAt: 1 });
emailSendSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const EmailSend = mongoose.model('EmailSend', emailSendSchema);
