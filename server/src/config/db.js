import mongoose from 'mongoose';

/**
 * Defaults for a serverless host. A short server selection timeout turns an unreachable
 * database (a wrong URI, an Atlas IP access list) into a quick, clear error instead of a
 * request that hangs until the 30 s function limit. A small pool keeps the many Vercel
 * instances under the connection limit of a small Atlas cluster.
 */
export const DATABASE_DEFAULTS = Object.freeze({
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
});

export async function connectDatabase(uri, options = {}) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { ...DATABASE_DEFAULTS, ...options });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
