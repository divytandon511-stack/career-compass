import { z } from 'zod';
import { CANONICAL_DIMENSIONS } from '../matching/constants.js';

const uuid = z.string().uuid();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const careerListQuerySchema = pagination.extend({
  q: z.string().trim().max(120).optional(),
  skillId: uuid.optional(),
  published: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['title', 'createdAt']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export const skillListQuerySchema = pagination.extend({
  q: z.string().trim().max(120).optional(),
  sort: z.literal('name').default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export const pathwayListQuerySchema = pagination;
export const savedCareerListQuerySchema = pagination.extend({
  sort: z.enum(['savedAt', 'title']).default('savedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export const careerIdSchema = z.object({ id: uuid }).strict();
export const careerLookupSchema = z.object({ idOrSlug: z.string().trim().min(1).max(120) }).strict();
export const skillIdSchema = z.object({ id: uuid }).strict();
export const pathwayIdSchema = z.object({ id: uuid }).strict();

const dimensions = Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, z.number().finite().min(0).max(1)]));
export const careerCreateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(10000).nullable().optional(),
  dimensionProfile: z.object(dimensions).strict(),
  skillIds: z.array(uuid).max(100).default([]),
  pathways: z.array(z.object({
    stage: z.string().trim().min(1).max(50),
    qualification: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(10000).nullable().optional(),
    verifiedAt: z.coerce.date().nullable().optional(),
  }).strict()).max(100).default([]),
}).strict().refine((value) => Object.values(value.dimensionProfile).some((score) => score > 0), {
  message: 'dimensionProfile must contain at least one non-zero dimension',
  path: ['dimensionProfile'],
});
export const careerUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  dimensionProfile: z.object(dimensions).strict().optional(),
  skillIds: z.array(uuid).max(100).optional(),
}).strict();
export const skillCreateSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export const pathwayCreateSchema = z.object({
  stage: z.string().trim().min(1).max(50),
  qualification: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(10000).nullable().optional(),
  verifiedAt: z.coerce.date().nullable().optional(),
}).strict();
export const pathwayUpdateSchema = pathwayCreateSchema.partial();
export const formatCareerValidationIssues = (error) =>
  error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message }));
