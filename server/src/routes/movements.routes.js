import { Router } from 'express';
import { movementsQuerySchema } from '@inventory/shared/schemas';
import * as movements from '../controllers/movements.controller.js';
import { protect } from '../middleware/protect.js';
import { validateQuery } from '../middleware/validate.js';

/** Any active user (admin or staff) may read all movements. */
export function movementsRoutes(config) {
  const router = Router();
  router.get(
    '/export',
    ...protect(config),
    validateQuery(movementsQuerySchema),
    movements.exportCsv,
  );
  router.get('/performers', ...protect(config), movements.performers);
  router.get('/', ...protect(config), validateQuery(movementsQuerySchema), movements.list);
  return router;
}
