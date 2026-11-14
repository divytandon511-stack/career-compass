import { AppError } from '../utils/app-error.js';
import { rankCareers } from '../matching/index.js';
import { scoreAssessment } from '../assessment/index.js';

const PAGE_MAX = 50;

const mapDatabaseError = (error, operation) => {
  if (error?.code === 'P2002') {
    throw new AppError('CONFLICT', 'The requested assessment state already exists', 409);
  }
  if (error?.code === 'P2025') {
    throw new AppError('NOT_FOUND', 'Assessment resource not found', 404);
  }
  error.operation = operation;
  throw error;
};

const assertDelegate = (client, delegateName) => {
  if (!client?.[delegateName] || typeof client[delegateName] !== 'object') {
    throw new Error(`Persistence client missing required "${delegateName}" delegate model`);
  }
};

const normalizePage = ({ page = 1, limit = 20 } = {}) => ({
  page: Math.max(1, Number(page)),
  limit: Math.min(PAGE_MAX, Math.max(1, Number(limit))),
});

const paginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

const lockAttempt = async (client, attemptId, studentId) => {
  if (typeof client.$queryRaw !== 'function') {
    const error = new Error('Database transaction client must support parameterized row locking');
    error.code = 'TRANSACTION_UNAVAILABLE';
    throw error;
  }

  const rows = await client.$queryRaw`
    SELECT id, student_id, assessment_id, status
    FROM assessment_attempts
    WHERE id = ${attemptId}::uuid
      AND student_id = ${studentId}::uuid
    FOR UPDATE
  `;

  if (!rows[0]) {
    throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
  }

  return rows[0];
};

const getOptionById = (question, optionId) => {
  if (!Array.isArray(question.options)) {
    throw new AppError('VALIDATION_ERROR', 'Question options are invalid', 422);
  }
  const option = question.options.find(
    (candidate) => candidate && candidate.id === optionId
  );
  if (
    !option ||
    typeof option.value !== 'number' ||
    !Number.isInteger(option.value) ||
    option.value < 0 ||
    option.value > 4
  ) {
    throw new AppError('VALIDATION_ERROR', 'Selected option is invalid', 422);
  }
  return option;
};

const mapQuestion = (question, { exposeValues = false } = {}) => ({
  id: question.id,
  assessmentId: question.assessmentId,
  dimension: question.dimension,
  prompt: question.prompt,
  position: question.position,
  ...(exposeValues
    ? { weight: Number(question.weight), options: question.options }
    : {
        options: Array.isArray(question.options)
          ? question.options.map(({ id, label }) => ({ id, label }))
          : [],
      }),
});

export class AssessmentRepositoryAdapter {
  constructor({ dbClient } = {}) {
    if (!dbClient || typeof dbClient !== 'object') {
      throw new Error('AssessmentRepositoryAdapter requires a dbClient dependency');
    }
    this.dbClient = dbClient;
  }

  async listAssessments({ role, page, limit, status, sort, order } = {}) {
    assertDelegate(this.dbClient, 'assessment');
    const pagination = normalizePage({ page, limit });
    const where = role === 'ADMIN' ? (status ? { status } : {}) : { status: 'PUBLISHED' };
    const orderBy = { [sort === 'createdAt' ? 'createdAt' : 'title']: order || 'asc' };

    try {
      const [items, total] = await Promise.all([
        this.dbClient.assessment.findMany({
          where,
          orderBy,
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        this.dbClient.assessment.count({ where }),
      ]);
      return {
        data: items.map(({ id, title, description, version, status: itemStatus, createdAt, updatedAt }) => ({
          id,
          title,
          description,
          version,
          status: itemStatus,
          createdAt,
          updatedAt,
        })),
        meta: paginationMeta({ ...pagination, total }),
      };
    } catch (error) {
      mapDatabaseError(error, 'listAssessments');
    }
  }

  async getAssessment({ assessmentId, role } = {}) {
    assertDelegate(this.dbClient, 'assessment');
    try {
      const assessment = await this.dbClient.assessment.findUnique({
        where: { id: assessmentId },
        include: { questions: { orderBy: { position: 'asc' } } },
      });
      if (!assessment || (role !== 'ADMIN' && assessment.status !== 'PUBLISHED')) {
        throw new AppError('NOT_FOUND', 'Assessment not found', 404);
      }
      return {
        id: assessment.id,
        title: assessment.title,
        description: assessment.description,
        version: assessment.version,
        status: assessment.status,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'getAssessment');
    }
  }

  async getQuestions({ assessmentId, role, page, limit } = {}) {
    assertDelegate(this.dbClient, 'assessment');
    try {
      const assessment = await this.dbClient.assessment.findUnique({
        where: { id: assessmentId },
        include: { questions: { orderBy: { position: 'asc' } } },
      });
      if (!assessment || (role !== 'ADMIN' && assessment.status !== 'PUBLISHED')) {
        throw new AppError('NOT_FOUND', 'Assessment not found', 404);
      }
      const mappedQuestions = assessment.questions.map((question) =>
        mapQuestion(question, { exposeValues: role === 'ADMIN' })
      );

      const isPaginated = page !== undefined || limit !== undefined;
      if (isPaginated) {
        const pagination = normalizePage({ page, limit });
        const start = (pagination.page - 1) * pagination.limit;
        const sliced = mappedQuestions.slice(start, start + pagination.limit);
        return {
          data: {
            assessmentId: assessment.id,
            version: assessment.version,
            questions: sliced,
          },
          meta: paginationMeta({ ...pagination, total: mappedQuestions.length }),
        };
      }

      return {
        data: {
          assessmentId: assessment.id,
          version: assessment.version,
          questions: mappedQuestions,
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'getQuestions');
    }
  }

  async createAttempt({ assessmentId, studentId } = {}) {
    assertDelegate(this.dbClient, 'assessment');
    assertDelegate(this.dbClient, 'assessmentAttempt');
    try {
      const assessment = await this.dbClient.assessment.findUnique({
        where: { id: assessmentId },
      });
      if (!assessment) throw new AppError('NOT_FOUND', 'Assessment not found', 404);
      if (assessment.status !== 'PUBLISHED') {
        throw new AppError('CONFLICT', 'Assessment is not published', 409);
      }
      const existingAttempt = await this.dbClient.assessmentAttempt.findFirst({
        where: {
          assessmentId: assessment.id,
          studentId,
          status: 'IN_PROGRESS',
        },
        orderBy: { startedAt: 'desc' },
      });
      if (existingAttempt) {
        return {
          id: existingAttempt.id,
          assessmentId: existingAttempt.assessmentId,
          assessmentVersion: existingAttempt.assessmentVersion,
          status: existingAttempt.status,
          startedAt: existingAttempt.startedAt,
          isResumed: true,
        };
      }
      const attempt = await this.dbClient.assessmentAttempt.create({
        data: {
          studentId,
          assessmentId: assessment.id,
          assessmentVersion: assessment.version,
          status: 'IN_PROGRESS',
        },
      });
      return {
        id: attempt.id,
        assessmentId: attempt.assessmentId,
        assessmentVersion: attempt.assessmentVersion,
        status: attempt.status,
        startedAt: attempt.startedAt,
        isResumed: false,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'createAttempt');
    }
  }

  async listAttempts({ studentId, page, limit, status, sort = 'startedAt', order = 'desc' } = {}) {
    assertDelegate(this.dbClient, 'assessmentAttempt');
    const pagination = normalizePage({ page, limit });
    const where = { studentId, ...(status ? { status } : {}) };
    try {
      const [items, total] = await Promise.all([
        this.dbClient.assessmentAttempt.findMany({
          where,
          orderBy: { [sort]: order },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        this.dbClient.assessmentAttempt.count({ where }),
      ]);
      return {
        data: items.map((item) => ({
          id: item.id,
          assessmentId: item.assessmentId,
          assessmentVersion: item.assessmentVersion,
          status: item.status,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
        })),
        meta: paginationMeta({ ...pagination, total }),
      };
    } catch (error) {
      mapDatabaseError(error, 'listAttempts');
    }
  }

  async getAttempt({ attemptId, studentId } = {}) {
    assertDelegate(this.dbClient, 'assessmentAttempt');
    try {
      const attempt = await this.dbClient.assessmentAttempt.findFirst({
        where: { id: attemptId, studentId },
        include: { answers: true },
      });
      if (!attempt) throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
      return attempt;
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'getAttempt');
    }
  }

  async saveAnswer({ attemptId, studentId, questionId, selectedOptionId } = {}) {
    if (typeof this.dbClient.$transaction !== 'function') {
      const error = new Error('Database transaction capability ($transaction) is required');
      error.code = 'TRANSACTION_UNAVAILABLE';
      throw error;
    }
    try {
      return await this.dbClient.$transaction(async (tx) => {
        assertDelegate(tx, 'assessmentAttempt');
        assertDelegate(tx, 'question');
        assertDelegate(tx, 'answer');
        const locked = await lockAttempt(tx, attemptId, studentId);
        if (locked.status !== 'IN_PROGRESS') {
          throw new AppError('CONFLICT', 'Completed assessment attempts cannot be changed', 409);
        }
        const attempt = await tx.assessmentAttempt.findUnique({
          where: { id: attemptId },
        });
        const question = await tx.question.findFirst({
          where: { id: questionId, assessmentId: attempt.assessmentId },
        });
        if (!question) throw new AppError('NOT_FOUND', 'Assessment question not found', 404);
        const option = getOptionById(question, selectedOptionId);
        const answer = await tx.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          create: {
            attemptId,
            questionId,
            selectedOptionId,
            score: option.value,
          },
          update: {
            selectedOptionId,
            score: option.value,
            answeredAt: new Date(),
          },
        });
        return {
          id: answer.id,
          attemptId: answer.attemptId,
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          answeredAt: answer.answeredAt,
        };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'saveAnswer');
    }
  }

  async finalizeAttempt({ attemptId, studentId } = {}) {
    if (typeof this.dbClient.$transaction !== 'function') {
      const error = new Error('Database transaction capability ($transaction) is required');
      error.code = 'TRANSACTION_UNAVAILABLE';
      throw error;
    }
    try {
      return await this.dbClient.$transaction(async (tx) => {
        for (const delegate of ['assessmentAttempt', 'assessment', 'career', 'recommendation']) {
          assertDelegate(tx, delegate);
        }
        const locked = await lockAttempt(tx, attemptId, studentId);
        if (locked.status !== 'IN_PROGRESS') {
          throw new AppError('CONFLICT', 'Assessment attempt has already been finalized', 409);
        }

        const attempt = await tx.assessmentAttempt.findFirst({
          where: { id: attemptId, studentId },
          include: {
            assessment: { include: { questions: { orderBy: { position: 'asc' } } } },
            answers: { include: { question: true } },
          },
        });
        if (!attempt) throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
        if (attempt.assessment.status !== 'PUBLISHED') {
          throw new AppError('CONFLICT', 'The assessment version is no longer published', 409);
        }
        if (attempt.assessment.version !== attempt.assessmentVersion) {
          throw new AppError('CONFLICT', 'Assessment version mismatch', 409);
        }

        const scoring = scoreAssessment({
          questions: attempt.assessment.questions,
          answers: attempt.answers.map(({ questionId, selectedOptionId }) => ({
            questionId,
            selectedOptionId,
          })),
        });
        const careers = await tx.career.findMany({
          where: { published: true },
          include: { dimensions: true },
        });
        const ranked = rankCareers(scoring.scores, careers);
        const algorithmVersion = ranked[0]?.algorithmVersion || 'cosine-v1';
        const completedAt = new Date();

        await tx.assessmentAttempt.update({
          where: { id: attemptId },
          data: {
            status: 'COMPLETED',
            scoresJson: scoring.scores,
            algorithmVersion,
            completedAt,
          },
        });

        if (ranked.length > 0) {
          await tx.recommendation.createMany({
            data: ranked.map((item) => ({
              attemptId,
              careerId: item.career.id,
              rank: item.rank,
              similarityScore: item.similarityScore,
              algorithmVersion: item.algorithmVersion,
              explanationJson: {
                reasons: item.reasons,
                cautions: item.cautions,
                careerProfileVersion: item.careerProfileVersion,
                dimensionSnapshot: item.dimensionSnapshot,
                algorithmWeights: item.algorithmWeights,
                dimensionContributions: item.dimensionContributions,
                isLowInformation: item.isLowInformation,
              },
            })),
          });
        }

        return {
          attemptId,
          status: 'COMPLETED',
          assessmentVersion: attempt.assessmentVersion,
          algorithmVersion,
          dimensionScores: scoring.scores,
          completedAt,
          recommendationsUrl: `/api/v1/attempts/${attemptId}/recommendations`,
        };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'finalizeAttempt');
    }
  }

  async listRecommendations({ attemptId, studentId, page, limit } = {}) {
    assertDelegate(this.dbClient, 'recommendation');
    assertDelegate(this.dbClient, 'assessmentAttempt');
    const pagination = normalizePage({ page, limit });
    try {
      const attempt = await this.dbClient.assessmentAttempt.findFirst({
        where: { id: attemptId, studentId },
      });
      if (!attempt) throw new AppError('NOT_FOUND', 'Assessment attempt not found', 404);
      if (attempt.status !== 'COMPLETED') {
        throw new AppError('CONFLICT', 'Assessment attempt is not completed', 409);
      }
      const where = { attemptId };
      const [items, total] = await Promise.all([
        this.dbClient.recommendation.findMany({
          where,
          orderBy: { rank: 'asc' },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
          include: { career: true },
        }),
        this.dbClient.recommendation.count({ where }),
      ]);
      return {
        data: items.map((item) => ({
          career: {
            id: item.career.id,
            slug: item.career.slug,
            title: item.career.title,
          },
          rank: item.rank,
          similarityScore: Number(item.similarityScore),
          algorithmVersion: item.algorithmVersion,
          careerProfileVersion: item.career.profileVersion,
          reasons: item.explanationJson?.reasons || [],
          cautions: item.explanationJson?.cautions || [],
        })),
        meta: paginationMeta({ ...pagination, total }),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDatabaseError(error, 'listRecommendations');
    }
  }
}

