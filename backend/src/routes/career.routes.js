import { Router } from 'express';
import { createCareerController } from '../controllers/career.controller.js';
import { requireRole } from '../middleware/rbac.js';

export const createCareerRouter = ({ careerService, authenticate } = {}) => {
  if (!careerService) throw new Error('createCareerRouter requires a careerService dependency');
  if (typeof authenticate !== 'function') throw new Error('createCareerRouter requires an authenticate middleware function dependency');
  const c = createCareerController({ careerService }); const router = Router();
  const admin = [authenticate, requireRole('ADMIN')]; const student = [authenticate, requireRole('STUDENT')];
  router.get('/careers', c.listCareers); router.get('/careers/:idOrSlug/pathways', c.listPathways); router.get('/careers/:idOrSlug', c.getCareer);
  router.post('/careers', ...admin, c.createCareer); router.patch('/careers/:id', ...admin, c.updateCareer); router.delete('/careers/:id', ...admin, c.archiveCareer);
  router.get('/skills', c.listSkills); router.post('/skills', ...admin, c.createSkill);
  router.post('/careers/:id/pathways', ...admin, c.createPathway); router.patch('/pathways/:id', ...admin, c.updatePathway);
  router.get('/users/me/saved-careers', ...student, c.listSavedCareers); router.put('/users/me/saved-careers/:careerId', ...student, c.saveCareer); router.delete('/users/me/saved-careers/:careerId', ...student, c.unsaveCareer);
  return router;
};
