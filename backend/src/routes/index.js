import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

const router = Router();

// Mount health check under /health
router.use('/health', healthRoutes);

export default router;
export { router as apiRouter };

