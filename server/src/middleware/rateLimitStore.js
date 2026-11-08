import { RateLimitHit } from '../models/RateLimitHit.js';

const DUPLICATE_KEY = 11000;

/**
 * A store for express-rate-limit that keeps the counters in MongoDB, so every serverless
 * instance (Vercel) shares them and a cold start does not reset them. The in-memory default
 * counts per instance only.
 * Each increment is one atomic update: a counter whose window is over starts again at 1.
 */
export class MongoRateLimitStore {
  /** `prefix` keeps the counters of different limiters apart (they key by the same IP). */
  constructor(prefix) {
    this.prefix = `${prefix}:`;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  id(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    const now = new Date();
    const freshReset = new Date(now.getTime() + this.windowMs);
    const live = { $gt: ['$resetAt', now] };
    const update = [
      {
        $set: {
          hits: { $cond: [live, { $add: ['$hits', 1] }, 1] },
          resetAt: { $cond: [live, '$resetAt', freshReset] },
        },
      },
    ];
    const options = { upsert: true, returnDocument: 'after' };
    let doc;
    try {
      doc = await RateLimitHit.collection.findOneAndUpdate({ _id: this.id(key) }, update, options);
    } catch (err) {
      // Two first hits at once both try to insert; the loser simply counts on the winner's.
      if (err?.code !== DUPLICATE_KEY) throw err;
      doc = await RateLimitHit.collection.findOneAndUpdate({ _id: this.id(key) }, update, options);
    }
    // Driver 6 returns the document; older drivers wrap it in { value }.
    const counter = doc && 'hits' in doc ? doc : doc?.value;
    return { totalHits: counter.hits, resetTime: counter.resetAt };
  }

  async get(key) {
    const counter = await RateLimitHit.findById(this.id(key)).lean();
    if (!counter || counter.resetAt <= new Date()) return undefined;
    return { totalHits: counter.hits, resetTime: counter.resetAt };
  }

  async decrement(key) {
    await RateLimitHit.updateOne({ _id: this.id(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await RateLimitHit.deleteOne({ _id: this.id(key) });
  }
}
