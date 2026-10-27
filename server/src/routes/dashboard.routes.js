import { Router } from 'express';
import * as dashboard from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/protect.js';

/** Any active user (admin or staff) may read the dashboard. */
export function dashboardRoutes(config) {
  const router = Router();
  router.get('/', ...protect(config), dashboard.get);
  return router;
}
