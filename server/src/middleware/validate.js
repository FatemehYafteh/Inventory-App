import { codeForMessage, m } from '@inventory/shared/errorCodes';
import { AppError } from '../utils/AppError.js';

function validationError(error) {
  const errors = {};
  const errorCodes = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_';
    if (field in errors) continue;
    errors[field] = issue.message;
    errorCodes[field] = codeForMessage(issue.message) ?? 'VALIDATION_INVALID';
  }
  return new AppError(400, 'VALIDATION_ERROR', m.VALIDATION_FAILED, errors, undefined, errorCodes);
}

/** Validates and replaces `req.body` with the parsed result of a shared Zod schema. */
export function validate(schema) {
  return function validateBody(req, _res, next) {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(validationError(result.error));
    req.body = result.data;
    next();
  };
}

/** Validates the query string and puts the parsed result on `req.validatedQuery`. */
export function validateQuery(schema) {
  return function validateQueryString(req, _res, next) {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) return next(validationError(result.error));
    req.validatedQuery = result.data;
    next();
  };
}
