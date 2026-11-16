/**
 * Basic health check controller.
 * Verifies that the HTTP application is responsive without claiming database/service readiness.
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
    },
  });
};

export const createReadyHandler = ({ check } = {}) => async (req, res, next) => {
  try {
    if (check) await check();
    return res.status(200).json({ data: { status: 'ready' } });
  } catch (error) {
    return next(new AppError('SERVICE_UNAVAILABLE', 'Service is not ready', 503));
  }
};

import { AppError } from '../utils/app-error.js';

