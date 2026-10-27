import { Router } from 'express';
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
} from '@inventory/shared/schemas';
import * as suppliers from '../controllers/suppliers.controller.js';
import { protect } from '../middleware/protect.js';
import { validate, validateQuery } from '../middleware/validate.js';

/** Any active user may read; only admins write. */
export function suppliersRoutes(config) {
  const router = Router();
  const anyActive = protect(config);
  const adminOnly = protect(config, 'admin');

  router.get('/', ...anyActive, validateQuery(listSuppliersQuerySchema), suppliers.list);
  router.post('/', ...adminOnly, validate(createSupplierSchema), suppliers.create);
  router.patch('/:id', ...adminOnly, validate(updateSupplierSchema), suppliers.update);
  router.delete('/:id', ...adminOnly, suppliers.remove);

  return router;
}
