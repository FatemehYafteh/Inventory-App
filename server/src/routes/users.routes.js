import { Router } from 'express';
import {
  changeRoleSchema,
  changeStatusSchema,
  listUsersQuerySchema,
} from '@inventory/shared/schemas';
import * as users from '../controllers/users.controller.js';
import { protect } from '../middleware/protect.js';
import { validate, validateQuery } from '../middleware/validate.js';

/** Admin only: every route sits behind the full gate chain with the admin role. */
export function usersRoutes(config) {
  const router = Router();
  const adminOnly = protect(config, 'admin');

  router.get('/', ...adminOnly, validateQuery(listUsersQuerySchema), users.list);
  router.get('/pending-count', ...adminOnly, users.pendingCount);
  router.patch('/:id/status', ...adminOnly, validate(changeStatusSchema), users.changeStatus);
  router.patch('/:id/role', ...adminOnly, validate(changeRoleSchema), users.changeRole);

  return router;
}
