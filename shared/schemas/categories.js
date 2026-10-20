import { z } from 'zod';

const title = z
  .string({ required_error: 'Enter a title' })
  .trim()
  .min(1, 'Enter a title')
  .max(100, 'Title must be at most 100 characters');

// An empty description is allowed: on create it means "none", on update it clears the field.
const description = z.string().trim().max(500, 'Description must be at most 500 characters');

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
    message: 'Nothing to update',
  });
