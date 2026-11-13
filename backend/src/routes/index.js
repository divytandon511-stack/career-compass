import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

export const createApiRouter = ({ authRouter, assessmentRouter, careerRouter, platformRouter, guidanceRouter } = {}) => {
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
  if (careerRouter) {
    router.use(careerRouter);
  }
  if (platformRouter) {
    router.use(platformRouter);
  }
  if (guidanceRouter) {
    router.use(guidanceRouter);
  }

  return router;
};

const defaultRouter = createApiRouter();

export default defaultRouter;
export { defaultRouter as apiRouter };

