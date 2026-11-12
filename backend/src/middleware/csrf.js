import { AppError } from '../utils/app-error.js';

/**
 * Normalizes an origin string (scheme + hostname + port) using the URL parser.
 * Rejects 'null', non-HTTP/HTTPS schemes, paths, or malformed formats.
 *
 * @param {string} originStr
 * @returns {string|null} Canonical lowercase origin or null if invalid
 */
const normalizeOrigin = (originStr) => {
  if (!originStr || typeof originStr !== 'string') {
    return null;
  }

  const trimmed = originStr.trim();
  // RFC 6454 opaque origin "null" (e.g. sandboxed iframe, file://, privacy mode) is untrusted
  if (trimmed.toLowerCase() === 'null') {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.origin === 'null') {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Creates CSRF protection middleware for cookie-authenticated endpoints.
 *
 * Security Invariants (CSRF-01):
 * 1. Scope: Enforced on all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
 * 2. Origin Header Validation: When Origin is present, strictly validates against allowlist.
 * 3. Conflicting Header Defense: When both Origin and Referer are present, verifies Referer origin matches Origin.
 * 4. Referer Fallback: When Origin is absent, permits Referer fallback ONLY if valid and allowlisted.
 * 5. Fail-Closed: Missing, null, malformed, conflicting, or untrusted origins are blocked with 403 FORBIDDEN.
 * 6. Exact Origin Matching: Matches full canonical scheme, host, and port without wildcards or substring logic.
 *
 * @param {object} [options={}]
 * @param {string[]} [options.allowedOrigins=[]] - List of authorized origin URLs
 * @returns {import('express').RequestHandler}
 */
export const createCsrfProtection = ({ allowedOrigins = [] } = {}) => {
  const normalizedAllowlist = new Set(
    allowedOrigins
      .map(normalizeOrigin)
      .filter((o) => typeof o === 'string' && o.length > 0)
  );

  return (req, res, next) => {
    // 1. Safe methods bypass CSRF verification (preflight OPTIONS, GET, HEAD)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const originHeader = req.headers.origin;
    const refererHeader = req.headers.referer;

    // Fail-closed: missing both Origin and Referer headers
    if (!originHeader && !refererHeader) {
      return next(
        new AppError(
          'FORBIDDEN',
          'Cross-site request blocked: missing Origin or Referer header',
          403
        )
      );
    }

    let originNormalized = null;

    // 2. Validate Origin if present
    if (originHeader !== undefined && originHeader !== null) {
      originNormalized = normalizeOrigin(originHeader);

      // Malformed, "null", or invalid Origin
      if (!originNormalized) {
        return next(
          new AppError(
            'FORBIDDEN',
            'Cross-site request blocked: untrusted origin',
            403
          )
        );
      }

      // Check allowlist
      if (!normalizedAllowlist.has(originNormalized)) {
        return next(
          new AppError(
            'FORBIDDEN',
            'Cross-site request blocked: untrusted origin',
            403
          )
        );
      }
    }

    // 3. Validate Referer if present
    if (refererHeader !== undefined && refererHeader !== null) {
      let refererOriginNormalized = null;
      try {
        const parsedReferer = new URL(refererHeader.trim());
        if (parsedReferer.origin === 'null' || !['http:', 'https:'].includes(parsedReferer.protocol)) {
          return next(
            new AppError(
              'FORBIDDEN',
              'Cross-site request blocked: invalid Referer header',
              403
            )
          );
        }
        refererOriginNormalized = parsedReferer.origin.toLowerCase();
      } catch {
        return next(
          new AppError(
            'FORBIDDEN',
            'Cross-site request blocked: invalid Referer header',
            403
          )
        );
      }

      // If Origin is also present: verify Referer origin matches Origin
      if (originNormalized) {
        if (refererOriginNormalized !== originNormalized) {
          return next(
            new AppError(
              'FORBIDDEN',
              'Cross-site request blocked: conflicting Origin and Referer headers',
              403
            )
          );
        }
      } else {
        // If Origin is absent: verify Referer origin against allowlist
        if (!normalizedAllowlist.has(refererOriginNormalized)) {
          return next(
            new AppError(
              'FORBIDDEN',
              'Cross-site request blocked: untrusted origin',
              403
            )
          );
        }
      }
    }

    next();
  };
};
