import { PrismaClient } from '@prisma/client';
import { createAuthenticate } from './middleware/authenticate.js';
import { AuthRepositoryAdapter } from './repositories/auth.repository.adapter.js';
import { AssessmentRepositoryAdapter } from './repositories/assessment.repository.adapter.js';
import { CareerRepositoryAdapter } from './repositories/career.repository.adapter.js';
import { PlatformRepository } from './repositories/platform.repository.js';
import { AuthService } from './services/auth.service.js';

export const createRuntimeDependencies = ({ dbClient = new PrismaClient() } = {}) => {
  const authRepository = new AuthRepositoryAdapter({ dbClient });
  const authService = new AuthService({ authRepository });
  const authenticate = createAuthenticate({
    findUserById: (userId) => authRepository.findUserById(userId),
  });

  return {
    dbClient,
    authService,
    authenticate,
    assessmentRepository: new AssessmentRepositoryAdapter({ dbClient }),
    careerRepository: new CareerRepositoryAdapter({ dbClient }),
    platformRepository: new PlatformRepository({ dbClient }),
    readinessCheck: () => dbClient.$queryRaw`SELECT 1`,
  };
};
