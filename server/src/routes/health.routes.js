import { m } from '@inventory/shared/errorCodes';
import { Router } from 'express';
import mongoose from 'mongoose';
import { perIp } from '../middleware/rateLimit.js';

/** How long the readiness check waits for the database before calling it down. */
export const READY_TIMEOUT_MS = 3000;

/** True when the database answers a ping within `timeoutMs`. Never throws. */
export async function databaseIsUp(timeoutMs = READY_TIMEOUT_MS) {
  if (mongoose.connection.readyState !== 1) return false;
  let timer;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('ping timed out')), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `GET /api/health`: liveness. The process is up; it does not touch the database.
 * `GET /api/health/ready`: readiness. Also pings the database and answers 503 when it is down,
 * so an uptime monitor or load balancer can tell "running" from "able to serve". Public and
 * cheap; limited per IP in memory (a database-backed limiter would itself hang during an outage).
 */
export function healthRoutes() {
  const router = Router();

  router.get('/', (_req, res) => res.json({ status: 'ok' }));

  router.get('/ready', perIp(60 * 1000, 120), async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (await databaseIsUp()) return res.json({ status: 'ok', database: 'up' });
    res.set('Retry-After', '5');
    return res.status(503).json({
      status: 'unavailable',
      database: 'down',
      message: m.SERVICE_UNAVAILABLE,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  return router;
}
