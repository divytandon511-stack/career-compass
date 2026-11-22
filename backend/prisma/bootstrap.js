import { PrismaClient } from '@prisma/client';
import { seedAssessment, backfillCompletedAttemptsRecommendations } from './seed.js';
import { seedCareerCatalog } from './seed-data/career-catalog.js';

const prisma = new PrismaClient();

try {
  const assessmentCount = await prisma.assessment.count();
  if (assessmentCount === 0) {
    console.log('[Bootstrap] No assessments found; creating the published assessment.');
    await seedAssessment(prisma);
  }

  const publishedCareerCount = await prisma.career.count({ where: { published: true } });
  if (publishedCareerCount === 0) {
    console.log('[Bootstrap] No published careers found; creating the career catalogue.');
    await seedCareerCatalog(prisma);
    await backfillCompletedAttemptsRecommendations(prisma);
  }
} catch (error) {
  console.error('[Bootstrap] Database initialization failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
