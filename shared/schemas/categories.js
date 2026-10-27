import { z } from 'zod';
import { m } from '../errorCodes.js';

const title = z
  .string({ required_error: m.TITLE_REQUIRED })
  .trim()
  .min(1, m.TITLE_REQUIRED)
  .max(100, m.TITLE_TOO_LONG_100);

// An empty description is allowed: on create it means "none", on update it clears the field.
const description = z.string().trim().max(500, m.DESCRIPTION_TOO_LONG_500);

export const createCategorySchema = z.object({
  title,
  description: description.optional(),
});

export const updateCategorySchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
  })
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: m.NOTHING_TO_UPDATE,
  });
