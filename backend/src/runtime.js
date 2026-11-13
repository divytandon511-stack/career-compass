import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from './middleware/authenticate.js';
import { AuthRepositoryAdapter } from './repositories/auth.repository.adapter.js';
import { AssessmentRepositoryAdapter } from './repositories/assessment.repository.adapter.js';
import { CareerRepositoryAdapter } from './repositories/career.repository.adapter.js';
import { PlatformRepository } from './repositories/platform.repository.js';
import { AuthService } from './services/auth.service.js';
import { GuidanceService } from './services/guidance.service.js';
import { GuidanceRepository } from './repositories/guidance.repository.js';
import { GuidanceLlmProvider } from './integrations/guidance-llm.js';

export const createRuntimeDependencies = ({ dbClient = new PrismaClient() } = {}) => {
  const authRepository = new AuthRepositoryAdapter({ dbClient });
  const authService = new AuthService({ authRepository });
  const authenticate = createAuthenticate({
    findUserById: (userId) => authRepository.findUserById(userId),
  });
  const guidanceRepository = process.env.MONGODB_URI
    ? new GuidanceRepository({
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB,
      retentionDays: Number(process.env.GUIDANCE_RETENTION_DAYS || 180),
    })
    : null;
  const guidanceService = new GuidanceService({
    sqlClient: dbClient,
    repository: guidanceRepository,
    llmProvider: new GuidanceLlmProvider({
      endpoint: process.env.LLM_API_URL,
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
    }),
    model: process.env.LLM_MODEL || 'unconfigured',
  });

  return {
    dbClient,
    authService,
    authenticate,
    assessmentRepository: new AssessmentRepositoryAdapter({ dbClient }),
    careerRepository: new CareerRepositoryAdapter({ dbClient }),
    platformRepository: new PlatformRepository({ dbClient }),
    guidanceService,
    readinessCheck: () => dbClient.$queryRaw`SELECT 1`,
  };
};
