import mongoose from 'mongoose';

/**
 * Rate-limit counters, one document per limiter and key. `resetAt` doubles as a TTL index, so
 * MongoDB deletes a counter on its own once its window is over.
 */
const rateLimitHitSchema = new mongoose.Schema(
  {
    _id: String,
    hits: { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
);
rateLimitHitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitHit =
  mongoose.models.RateLimitHit ?? mongoose.model('RateLimitHit', rateLimitHitSchema);
