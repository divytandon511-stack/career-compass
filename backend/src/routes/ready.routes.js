import { Router } from 'express';
import { createReadyHandler } from '../controllers/health.controller.js';

export const createReadyRoutes = ({ check } = {}) => {
  const router = Router();
  router.get('/', createReadyHandler({ check }));
  return router;
};
