import { AppError } from '../utils/AppError.js';

/** Validates and replaces `req.body` with the parsed result of a shared Zod schema. */
export function validate(schema) {
  return function validateBody(req, _res, next) {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || '_';
        errors[field] ??= issue.message;
      }
      return next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors));
    }
    req.body = result.data;
    next();
  };
}
