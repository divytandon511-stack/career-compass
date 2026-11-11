import { AppError } from '../utils/app-error.js';

/**
 * Middleware to catch unmapped routes and forward a 404 AppError
 */
export const notFoundHandler = (req, res, next) => {
  next(new AppError('NOT_FOUND', `Resource not found: ${req.method} ${req.originalUrl}`, 404));
};

