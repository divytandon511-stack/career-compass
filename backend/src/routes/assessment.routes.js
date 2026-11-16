import { Router } from 'express';
import { createAssessmentController } from '../controllers/assessment.controller.js';
import { requireRole } from '../middleware/rbac.js';

export const createAssessmentRouter = ({
  assessmentService,
  authenticate,
} = {}) => {
  if (!assessmentService) {
    throw new Error('createAssessmentRouter requires an assessmentService dependency');
  }
  if (typeof authenticate !== 'function') {
    throw new Error('createAssessmentRouter requires an authenticate middleware function dependency');
  }

  const router = Router();
  const controller = createAssessmentController({ assessmentService });
  const authenticated = [authenticate, requireRole('STUDENT', 'COUNSELLOR', 'ADMIN')];
  const studentOnly = [authenticate, requireRole('STUDENT')];
  const studentOrAdmin = [authenticate, requireRole('STUDENT', 'ADMIN')];

  router.get('/assessments', ...authenticated, controller.listAssessments);
  router.get('/assessments/:id/questions', ...studentOrAdmin, controller.getQuestions);
  router.get('/assessments/:id', ...authenticated, controller.getAssessment);
  router.post('/assessments/:id/attempts', ...studentOnly, controller.startAttempt);

  router.get('/attempts', ...studentOnly, controller.listAttempts);
  router.get('/attempts/:id/recommendations', ...studentOnly, controller.listRecommendations);
  router.get('/attempts/:id', ...studentOnly, controller.getAttempt);
  router.put('/attempts/:id/answers/:questionId', ...studentOnly, controller.saveAnswer);
  router.post('/attempts/:id/submit', ...studentOnly, controller.submitAttempt);

  return router;
};

