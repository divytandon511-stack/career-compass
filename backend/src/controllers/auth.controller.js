import { AppError } from '../utils/app-error.js';
import {
  setRefreshCookie,
  clearRefreshCookie,
  extractRefreshCookie,
} from '../utils/cookie.js';

/**
 * Creates thin authentication controllers using injected AuthService.
 * Adheres strictly to docs/api-contract.md §2 and Stage 3 security contracts.
 *
 * @param {object} dependencies
 * @param {import('../services/auth.service.js').AuthService} dependencies.authService
 * @param {boolean} [dependencies.isSecure=process.env.NODE_ENV === 'production']
 * @returns {object} Controller action handlers
 */
export const createAuthController = ({
  authService,
  isSecure = process.env.NODE_ENV === 'production',
} = {}) => {
  if (!authService) {
    throw new Error('createAuthController requires an authService dependency');
  }

  return {
    /**
     * POST /api/v1/auth/register
     * Registers a new student account.
     * Response: 201 Created with `{ data: { user: { id, email, role } } }`.
     */
    register: async (req, res, next) => {
      try {
        const result = await authService.register(req.body);
        return res.status(201).json({
          data: {
            user: result.user,
          },
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/v1/auth/login
     * Authenticates user credentials, sets HttpOnly refresh cookie, and returns access token.
     * Response: 200 OK with `{ data: { accessToken, expiresIn, user: { id, email, role } } }`.
     */
    login: async (req, res, next) => {
      try {
        const result = await authService.login(req.body);

        // Set refresh token in HttpOnly secure cookie — never expose in JSON response
        setRefreshCookie(res, result.refreshToken, { isSecure });

        return res.status(200).json({
          data: {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
            user: result.user,
          },
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/v1/auth/refresh
     * Rotates refresh token from cookie and issues fresh access token.
     * Response: 200 OK with `{ data: { accessToken, expiresIn } }`.
     */
    refresh: async (req, res, next) => {
      try {
        const rawRefreshToken = extractRefreshCookie(req, { isSecure });
        if (!rawRefreshToken) {
          throw new AppError('UNAUTHORIZED', 'Refresh token cookie is required', 401);
        }

        const result = await authService.refresh(rawRefreshToken);

        // Set refreshed cookie only after successful atomic rotation — never expose in JSON
        setRefreshCookie(res, result.refreshToken, { isSecure });

        return res.status(200).json({
          data: {
            accessToken: result.accessToken,
            expiresIn: result.expiresIn,
          },
        });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /api/v1/auth/logout
     * Revokes active session or all sessions for a user, clears cookie, and returns 204.
     * Response: 204 No Content (empty body).
     */
    logout: async (req, res, next) => {
      try {
        const rawRefreshToken = extractRefreshCookie(req, { isSecure });

        // Derive trusted identity strictly from verified authentication middleware
        // NEVER read from client-controlled fields (req.body, req.query, req.params)
        const authenticatedUserId = req.user?.id;
        const allDevices = Boolean(req.body?.allDevices);

        await authService.logout({
          refreshToken: rawRefreshToken || undefined,
          authenticatedUserId,
          allDevices,
        });

        // Clear refresh cookie
        clearRefreshCookie(res, { isSecure });

        return res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /api/v1/auth/me
     * Returns verified authoritative user profile for current access token.
     * Response: 200 OK with `{ data: { user: { id, email, role } } }`.
     */
    me: async (req, res, next) => {
      try {
        if (!req.user) {
          throw new AppError('UNAUTHORIZED', 'Authentication token is required', 401);
        }

        return res.status(200).json({
          data: {
            user: {
              id: req.user.id,
              email: req.user.email,
              role: req.user.role,
            },
          },
        });
      } catch (err) {
        next(err);
      }
    },
  };
};
