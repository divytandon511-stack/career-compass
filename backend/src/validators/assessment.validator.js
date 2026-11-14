import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const answerSchema = z
  .object({
    optionId: z.string().trim().min(1),
  })
  .strict();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const questionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const assessmentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sort: z.enum(['title', 'createdAt']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const attemptListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  sort: z.enum(['startedAt', 'completedAt']).default('startedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const assessmentIdSchema = z.object({ id: uuidSchema }).strict();
export const attemptIdSchema = z.object({ id: uuidSchema }).strict();
export const questionIdSchema = z
  .object({ id: uuidSchema, questionId: uuidSchema })
  .strict();

export const formatValidationIssues = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    issue: issue.message,
  }));

