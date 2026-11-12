import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import {
  registerRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
} from '../middleware/rate-limit.js';
import { createCsrfProtection } from '../middleware/csrf.js';

/**
 * Creates dependency-injected authentication router.
 *
 * @param {object} dependencies
 * @param {import('../services/auth.service.js').AuthService} dependencies.authService
 * @param {import('express').RequestHandler} dependencies.authenticate - Verified auth middleware
 * @param {string[]} [dependencies.allowedOrigins] - Frontend origins for CSRF validation
 * @param {boolean} [dependencies.isSecure=process.env.NODE_ENV === 'production']
 * @param {import('express').RequestHandler} [dependencies.registerLimiter]
 * @param {import('express').RequestHandler} [dependencies.loginLimiter]
 * @param {import('express').RequestHandler} [dependencies.refreshLimiter]
 * @param {import('express').RequestHandler} [dependencies.csrfProtection]
 * @returns {import('express').Router}
 */
export const createAuthRouter = ({
  authService,
  authenticate,
  allowedOrigins = [],
  isSecure = process.env.NODE_ENV === 'production',
  registerLimiter = registerRateLimiter,
  loginLimiter = loginRateLimiter,
  refreshLimiter = refreshRateLimiter,
  csrfProtection,
} = {}) => {
  const router = Router();
  const controller = createAuthController({ authService, isSecure });

  const csrf = csrfProtection || createCsrfProtection({ allowedOrigins });

  // Optional authentication helper for logout: runs authenticate if Authorization header is present
  const optionalAuthenticate = (req, res, next) => {
    if (req.headers.authorization || req.headers.Authorization) {
      if (typeof authenticate === 'function') {
        return authenticate(req, res, next);
      }
    }
    next();
  };

  // POST /api/v1/auth/register
  router.post('/register', registerLimiter, controller.register);

  // POST /api/v1/auth/login
  router.post('/login', loginLimiter, controller.login);

  // POST /api/v1/auth/refresh (cookie-authenticated, protected by CSRF and refresh rate limit)
  router.post('/refresh', refreshLimiter, csrf, controller.refresh);

  // POST /api/v1/auth/logout (cookie-authenticated, protected by CSRF, optional bearer context)
  router.post('/logout', csrf, optionalAuthenticate, controller.logout);

  // GET /api/v1/auth/me (requires strict cryptographic Bearer authentication)
  router.get('/me', authenticate, controller.me);

  return router;
};
