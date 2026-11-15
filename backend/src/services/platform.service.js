import { z } from 'zod';
import { AppError } from '../utils/app-error.js';

const uuid = z.string().uuid();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const status = z.enum(['ACTIVE', 'SUSPENDED']);
const bookingStatus = z.enum(['CANCELLED', 'COMPLETED']);
const date = z.coerce.date();

const parse = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please correct the supplied fields.',
      422,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message }))
    );
  }
  return result.data;
};

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  schoolGrade: z.string().trim().max(10).optional(),
}).strict();

const assessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().nullable().optional(),
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
}).strict();

const questionSchema = z.object({
  prompt: z.string().trim().min(1),
  dimension: z.enum(['ANALYTICAL', 'CREATIVE', 'SOCIAL', 'PRACTICAL', 'ORGANIZATIONAL', 'INVESTIGATIVE']),
  weight: z.coerce.number().finite().positive(),
  position: z.number().int().positive(),
  options: z.array(z.object({
    id: z.string().trim().min(1).max(36),
    label: z.string().trim().min(1),
    value: z.number().int().min(0).max(4),
  }).strict()).min(2),
}).strict();

const slotSchema = z.object({
  startsAt: date,
  endsAt: date,
}).strict().refine(({ startsAt, endsAt }) => endsAt > startsAt, {
  message: 'endsAt must be after startsAt',
  path: ['endsAt'],
});

export class PlatformService {
  constructor({ repository } = {}) {
    if (!repository) throw new Error('PlatformService requires a repository dependency');
    this.repository = repository;
  }

  getUser(userId) { return this.repository.getUser(userId); }

  updateUser({ user, body }) {
    const data = parse(profileSchema, body);
    if (data.schoolGrade !== undefined && user.role !== 'STUDENT') {
      throw new AppError('VALIDATION_ERROR', 'schoolGrade is only available to students', 422);
    }
    return this.repository.updateUser({ userId: user.id, ...data });
  }

  listUsers(query) {
    return this.repository.listUsers(parse(pagination.extend({
      role: z.enum(['STUDENT', 'COUNSELLOR', 'ADMIN']).optional(),
      status: status.optional(),
      sort: z.enum(['createdAt', 'email']).default('createdAt'),
      order: z.enum(['asc', 'desc']).default('desc'),
    }), query));
  }

  updateUserStatus({ userId, body }) {
    return this.repository.updateUserStatus({
      userId: parse(uuid, userId),
      status: parse(z.object({ status }), body).status,
    });
  }

  createAssessment(body) { return this.repository.createAssessment(parse(assessmentSchema, body)); }

  updateAssessment({ assessmentId, body }) {
    const data = parse(assessmentSchema.partial().strict(), body);
    return this.repository.updateAssessment({ assessmentId: parse(uuid, assessmentId), data });
  }

  createQuestion({ assessmentId, body }) {
    return this.repository.createQuestion({
      assessmentId: parse(uuid, assessmentId),
      data: parse(questionSchema, body),
    });
  }

  updateQuestion({ questionId, body }) {
    return this.repository.updateQuestion({
      questionId: parse(uuid, questionId),
      data: parse(questionSchema.partial().strict(), body),
    });
  }

  listCounsellors(query) {
    return this.repository.listCounsellors({ ...parse(pagination, query), q: query.q });
  }

  getCounsellor(counsellorId) {
    return this.repository.getCounsellor({ counsellorId: parse(uuid, counsellorId) });
  }

  listSlots({ counsellorId, query, own = false }) {
    const data = parse(pagination.extend({ from: date.optional(), to: date.optional() }), query);
    return this.repository.listSlots({ counsellorId: parse(uuid, counsellorId), ...data, own });
  }

  createSlot({ counsellorId, body }) {
    return this.repository.createSlot({ counsellorId: parse(uuid, counsellorId), ...parse(slotSchema, body) });
  }

  deleteSlot({ counsellorId, slotId }) {
    return this.repository.deleteSlot({ counsellorId: parse(uuid, counsellorId), slotId: parse(uuid, slotId) });
  }

  createBooking({ user, body }) {
    const data = parse(z.object({ slotId: uuid, note: z.string().max(500).optional() }).strict(), body);
    return this.repository.createBooking({ studentId: user.id, ...data });
  }

  listBookings({ user, query }) {
    const data = parse(pagination.extend({
      status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
      sort: z.enum(['createdAt', 'startsAt']).default('createdAt'),
      order: z.enum(['asc', 'desc']).default('desc'),
    }), query);
    return this.repository.listBookings({ userId: user.id, role: user.role, ...data });
  }

  getBooking({ user, bookingId }) {
    return this.repository.getBooking({ bookingId: parse(uuid, bookingId), userId: user.id, role: user.role });
  }

  updateBookingStatus({ user, bookingId, body }) {
    return this.repository.updateBookingStatus({
      bookingId: parse(uuid, bookingId),
      userId: user.id,
      role: user.role,
      status: parse(z.object({ status: bookingStatus }).strict(), body).status,
    });
  }

  overviewAnalytics(query) {
    const data = parse(z.object({ from: date.optional(), to: date.optional() }).strict(), query);
    return this.repository.overviewAnalytics(data);
  }

  careerInterestAnalytics(query) {
    return this.repository.careerInterestAnalytics(parse(pagination, query));
  }
}

export const createPlatformService = (dependencies) => new PlatformService(dependencies);
