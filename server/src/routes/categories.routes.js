import { Router } from 'express';
import { createCategorySchema, updateCategorySchema } from '@inventory/shared/schemas';
import * as categories from '../controllers/categories.controller.js';
import { protect } from '../middleware/protect.js';
import { validate } from '../middleware/validate.js';

/** Any active user may read; only admins write. */
export function categoriesRoutes(config) {
  const router = Router();
  const anyActive = protect(config);
  const adminOnly = protect(config, 'admin');

  router.get('/', ...anyActive, categories.list);
  router.post('/', ...adminOnly, validate(createCategorySchema), categories.create);
  router.patch('/:id', ...adminOnly, validate(updateCategorySchema), categories.update);
  router.delete('/:id', ...adminOnly, categories.remove);

  return router;
}
