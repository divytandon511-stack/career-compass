import { Router } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { createAuthLimiter } from '../middleware/rate-limit.js';
import { createGuidanceController } from '../controllers/guidance.controller.js';

export const createGuidanceRouter = ({ service, authenticate } = {}) => {
  if (!service || typeof authenticate !== 'function') {
    throw new Error('createGuidanceRouter requires service and authenticate dependencies');
  }
  const router = Router();
  const controller = createGuidanceController({ service });
  const student = [authenticate, requireRole('STUDENT')];
  const guidanceLimiter = createAuthLimiter({
    windowMs: Number(process.env.GUIDANCE_RATE_LIMIT_WINDOW_MS || 30_000),
    max: Number(process.env.GUIDANCE_RATE_LIMIT_MAX || 10),
    keyGenerator: (req) => req.user?.id || req.ip,
    message: 'Too many guidance requests, please try again later.',
  });

  router.post('/guidance/sessions', ...student, controller.createSession);
  router.get('/guidance/sessions', ...student, controller.listSessions);
  router.get('/guidance/sessions/:id', ...student, controller.getSession);
  router.post('/guidance/sessions/:id/messages', ...student, guidanceLimiter, controller.sendMessage);
  router.delete('/guidance/sessions/:id', ...student, controller.deleteSession);
  return router;
};
