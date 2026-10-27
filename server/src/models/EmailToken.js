import mongoose from 'mongoose';

export const EMAIL_TOKEN_TYPES = ['verify_email', 'reset_password', 'link_telegram'];

const emailTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: EMAIL_TOKEN_TYPES, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailTokenSchema.index({ user: 1, type: 1 });
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailToken = mongoose.model('EmailToken', emailTokenSchema);
