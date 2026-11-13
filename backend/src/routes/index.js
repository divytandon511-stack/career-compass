import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

export const createApiRouter = ({ authRouter, assessmentRouter } = {}) => {
  const router = Router();

  // Mount health check under /health
  router.use('/health', healthRoutes);

  // Mount auth routes under /auth when configured
  if (authRouter) {
    router.use('/auth', authRouter);
  }

  if (assessmentRouter) {
    router.use(assessmentRouter);
  }

  return router;
};

const defaultRouter = createApiRouter();

export default defaultRouter;
export { defaultRouter as apiRouter };

