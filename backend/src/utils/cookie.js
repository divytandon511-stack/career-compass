/**
 * ============================================================================
 * CareerCompass — Refresh Cookie Security Configuration & Utilities
 * ============================================================================
 * Aligned with docs/architecture.md §2 and RFC 6265bis Cookie Prefix Standard.
 *
 * Security Invariants:
 * 1. __Host- Prefix in Secure Deployments:
 *    When `isSecure === true` (production / HTTPS environments), the cookie name
 *    is `__Host-refreshToken`. RFC 6265bis mandates:
 *    - Must be delivered with the `Secure` flag.
 *    - Must originate from a secure scheme (HTTPS).
 *    - Must have `Path=/`.
 *    - Must NOT specify a `Domain` attribute (host-only binding).
 * 2. Local Development vs. Production Topology:
 *    In local HTTP development (`http://localhost`), browsers reject __Host- cookies
 *    because the connection is not HTTPS. Therefore, in development/test on HTTP,
 *    `refreshToken` (without __Host-) is used with `secure: false`.
 * 3. Cross-Site Deployment Constraints:
 *    `SameSite=Strict` is enforced by default. If frontend and backend are hosted
 *    on completely different registrable domains (cross-site), browsers will withhold
 *    SameSite=Strict cookies on cross-site requests. In production, CareerCompass
 *    architecture mandates same-site or reverse-proxy routing (e.g. app.careercompass.in
 *    and api.careercompass.in or same domain via path routing), allowing SameSite=Strict.
 * 4. HttpOnly Invariant:
 *    `httpOnly: true` is always enforced, completely preventing client-side JavaScript
 *    from reading or extracting the refresh token.
 * 5. Expiration:
 *    `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days in milliseconds, 604,800,000 ms).
 * ============================================================================
 */

export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns configuration object for refresh token cookies.
 *
 * @param {object} [options={}]
 * @param {boolean} [options.isSecure=process.env.NODE_ENV === 'production']
 * @returns {{ name: string, options: import('express').CookieOptions }}
 */
export const getRefreshCookieConfig = ({ isSecure = process.env.NODE_ENV === 'production' } = {}) => {
  const name = isSecure ? '__Host-refreshToken' : 'refreshToken';
  return {
    name,
    options: {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/',
      // Strictly NO domain attribute to satisfy __Host- requirements
    },
  };
};

/**
 * Sets the refresh token cookie on the outgoing response.
 *
 * @param {import('express').Response} res
 * @param {string} refreshToken - Plaintext 64-character lowercase hex token
 * @param {object} [options={}]
 * @param {boolean} [options.isSecure=process.env.NODE_ENV === 'production']
 */
export const setRefreshCookie = (
  res,
  refreshToken,
  { isSecure = process.env.NODE_ENV === 'production' } = {}
) => {
  const { name, options } = getRefreshCookieConfig({ isSecure });
  res.cookie(name, refreshToken, options);
};

/**
 * Clears the refresh token cookie from the client.
 *
 * @param {import('express').Response} res
 * @param {object} [options={}]
 * @param {boolean} [options.isSecure=process.env.NODE_ENV === 'production']
 */
export const clearRefreshCookie = (
  res,
  { isSecure = process.env.NODE_ENV === 'production' } = {}
) => {
  const { name } = getRefreshCookieConfig({ isSecure });
  res.clearCookie(name, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
  });

  // If in secure mode, defensively clear the legacy/development cookie name as well
  if (name !== 'refreshToken') {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
    });
  }
};

/**
 * Extracts raw refresh token string from parsed request cookies according to environment security configuration.
 *
 * Security Requirements (COOKIE-01):
 * - In secure mode (`isSecure: true`), accept ONLY `__Host-refreshToken`. Never fall back to `refreshToken`.
 * - In non-secure development mode (`isSecure: false`), accept ONLY `refreshToken`.
 * - Never silently choose a different cookie name when the expected cookie is missing.
 *
 * @param {import('express').Request} req
 * @param {object} [options={}]
 * @param {boolean} [options.isSecure=process.env.NODE_ENV === 'production']
 * @returns {string|null}
 */
export const extractRefreshCookie = (
  req,
  { isSecure = process.env.NODE_ENV === 'production' } = {}
) => {
  if (!req.cookies || typeof req.cookies !== 'object') {
    return null;
  }

  const expectedName = isSecure ? '__Host-refreshToken' : 'refreshToken';
  const token = req.cookies[expectedName];

  if (typeof token === 'string' && token.length > 0) {
    return token;
  }

  return null;
};
