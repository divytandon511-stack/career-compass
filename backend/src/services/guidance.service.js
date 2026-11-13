import { z } from 'zod';
import { AppError } from '../utils/app-error.js';

const uuid = z.string().uuid();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.literal('updatedAt').default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
const createSchema = z.object({
  attemptId: uuid,
  careerIds: z.array(uuid).min(1).max(10),
}).strict().refine(({ careerIds }) => new Set(careerIds).size === careerIds.length, {
  message: 'careerIds must be unique',
  path: ['careerIds'],
});
const messageSchema = z.object({ message: z.string().trim().min(1).max(1000) }).strict();

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please correct the supplied fields.',
      422,
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), issue: issue.message })),
    );
  }
  return result.data;
};

const sanitizeMessage = (message) => message.replace(/<[^>]*>/g, '').trim();

export class GuidanceService {
  constructor({ sqlClient, repository, llmProvider, model = 'unconfigured' } = {}) {
    if (!sqlClient) throw new Error('GuidanceService requires a sqlClient dependency');
    this.sqlClient = sqlClient;
    this.repository = repository;
    this.llmProvider = llmProvider;
    this.model = model;
  }

  async createSession({ user, body }) {
    const { attemptId, careerIds } = parse(createSchema, body);
    if (!this.repository) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    const attempt = await this.sqlClient.assessmentAttempt.findFirst({
      where: { id: attemptId, studentId: user.id, status: 'COMPLETED' },
      select: { id: true },
    });
    if (!attempt) throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
    const careers = await this.sqlClient.career.findMany({
      where: { id: { in: careerIds }, published: true },
      select: { id: true },
    });
    if (careers.length !== careerIds.length) {
      throw new AppError('VALIDATION_ERROR', 'All selected careers must be published', 422);
    }
    const session = await this.repository.create({
      studentId: user.id,
      attemptId,
      careerIds,
      modelName: this.model,
    });
    return {
      sessionId: session.sessionId,
      attemptId: session.attemptId,
      careerIds: session.careerIds,
      createdAt: session.createdAt,
    };
  }

  listSessions({ user, query }) {
    const { page, limit } = parse(pagination, query);
    if (!this.repository) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    return this.repository.list({ studentId: user.id, page, limit });
  }

  getSession({ user, sessionId }) {
    if (!this.repository) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    return this.repository.get({ studentId: user.id, sessionId });
  }

  async sendMessage({ user, sessionId, body }) {
    const { message: rawMessage } = parse(messageSchema, body);
    const message = sanitizeMessage(rawMessage);
    if (!message) throw new AppError('VALIDATION_ERROR', 'Message must contain text', 422);
    if (!this.repository || !this.llmProvider) {
      throw new AppError('AI_UNAVAILABLE', 'AI guidance is unavailable', 503);
    }
    const session = await this.repository.get({ studentId: user.id, sessionId });
    const attempt = await this.sqlClient.assessmentAttempt.findFirst({
      where: { id: session.attemptId, studentId: user.id, status: 'COMPLETED' },
      select: { scoresJson: true },
    });
    if (!attempt) throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
    const careers = await this.sqlClient.career.findMany({
      where: { id: { in: session.careerIds }, published: true },
      include: { dimensions: true, careerSkills: { include: { skill: true } }, pathways: true },
    });
    if (careers.length !== session.careerIds.length) {
      throw new AppError('CONFLICT', 'Guidance careers are no longer available', 409);
    }
    const groundedContext = {
      dimensionScores: attempt.scoresJson,
      careers: careers.map((career) => ({
        id: career.id,
        title: career.title,
        summary: career.description,
        dimensions: career.dimensions.map((item) => ({ dimension: item.dimension, targetWeight: Number(item.targetWeight) })),
        skills: career.careerSkills.map(({ skill }) => skill.name),
        pathways: career.pathways.map(({ stage, qualification, notes }) => ({ stage, qualification, notes })),
      })),
      recentMessages: session.messages.slice(-12).map(({ role, text }) => ({ role, text })),
    };
    let context = JSON.stringify(groundedContext);
    if (context.length > 4000) {
      context = JSON.stringify({
        dimensionScores: attempt.scoresJson,
        careers: careers.map(({ id, title, dimensions }) => ({
          id,
          title,
          dimensions: dimensions.map(({ dimension, targetWeight }) => ({
            dimension,
            targetWeight: Number(targetWeight),
          })),
        })),
        recentMessages: groundedContext.recentMessages,
      });
    }
    const generated = await this.llmProvider.generate({
      context,
      message,
      careerIds: session.careerIds,
    });
    const createdAt = new Date();
    await this.repository.appendMessages({
      studentId: user.id,
      sessionId,
      messages: [
        { role: 'user', text: message, groundingCareerIds: [] },
        { role: 'assistant', text: generated.text, groundingCareerIds: generated.groundingCareerIds },
      ],
    });
    return {
      sessionId,
      message: { ...generated, createdAt },
    };
  }

  deleteSession({ user, sessionId }) {
    if (!this.repository) throw new AppError('DB_UNAVAILABLE', 'Guidance history is unavailable', 503);
    return this.repository.remove({ studentId: user.id, sessionId });
  }
}

export const createGuidanceService = (dependencies) => new GuidanceService(dependencies);
