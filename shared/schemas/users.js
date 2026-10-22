import { z } from 'zod';
import { m } from '../errorCodes.js';

export const USER_STATUSES = ['pending', 'active', 'rejected'];
export const USER_ROLES = ['admin', 'staff'];

const emptyToUndefined = (value) => value || undefined;

/** Admin: approve, reject or reactivate a user. The reason is optional. */
export const changeStatusSchema = z.object({
  status: z.enum(USER_STATUSES, { errorMap: () => ({ message: m.STATUS_INVALID }) }),
  reason: z.string().trim().max(500, m.REASON_TOO_LONG).optional().transform(emptyToUndefined),
});

export const changeRoleSchema = z.object({
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: m.ROLE_INVALID }) }),
});

/**
 * The Users page query. `status` is the tab. On the Pending tab only complete profiles are
 * listed, unless `incomplete` is true, which lists the unfinished signups instead.
 */
export const listUsersQuerySchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  search: z.string().trim().max(100, m.SEARCH_TOO_LONG).optional().transform(emptyToUndefined),
  incomplete: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
