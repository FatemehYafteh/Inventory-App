import { Router } from 'express';
import {
  createProductSchema,
  listMovementsQuerySchema,
  listProductsQuerySchema,
  stockChangeSchema,
  updateProductSchema,
} from '@inventory/shared/schemas';
import * as products from '../controllers/products.controller.js';
import { protect } from '../middleware/protect.js';
import { validate, validateQuery } from '../middleware/validate.js';

/** Any active user may read; admins and staff create and edit; only admins archive and restore. */
export function productsRoutes(config) {
  const router = Router();
  const anyActive = protect(config);
  const editors = protect(config, 'admin', 'staff');
  const adminOnly = protect(config, 'admin');

  router.get('/', ...anyActive, validateQuery(listProductsQuerySchema), products.list);
  router.get('/export', ...anyActive, validateQuery(listProductsQuerySchema), products.exportCsv);
  router.post('/', ...editors, validate(createProductSchema), products.create);
  router.get('/:id', ...anyActive, products.get);
  router.patch('/:id', ...editors, validate(updateProductSchema), products.update);
  router.post('/:id/stock', ...editors, validate(stockChangeSchema), products.changeStock);
  router.get(
    '/:id/movements',
    ...anyActive,
    validateQuery(listMovementsQuerySchema),
    products.movements,
  );
  router.patch('/:id/archive', ...adminOnly, products.archive);
  router.patch('/:id/restore', ...adminOnly, products.restore);

  return router;
}
