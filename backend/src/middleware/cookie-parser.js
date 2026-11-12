import { AppError } from '../utils/app-error.js';

const SENSITIVE_AUTH_COOKIES = new Set(['refreshToken', '__Host-refreshToken']);

// Valid cookie-name characters per RFC 6265 §4.1.1 (excluding CTLs and separators)
const COOKIE_NAME_REGEX = /^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/;

/**
 * Safe, dependency-free cookie header parser.
 * Populates dictionary with parsed key-value pairs from the raw Cookie header.
 *
 * Security Invariants (COOKIE-02):
 * 1. Prototype Pollution Defense: Uses Object.create(null) to prevent __proto__ or constructor shadowing.
 * 2. Strict Character Validation: Rejects malformed or whitespace-laden cookie names.
 * 3. Safe Percent Decoding: Handles malformed percent-encoding safely without throwing uncontrolled exceptions.
 * 4. Duplicate Handling:
 *    - For sensitive authentication cookies (refreshToken, __Host-refreshToken), rejects duplicates with 400 BAD_REQUEST.
 *    - For general cookies, preserves the first occurrence to honor RFC 6265 path specificity ordering.
 *
 * @param {string|undefined} cookieHeader - Raw header string (e.g. "key=val; key2=val2")
 * @returns {Record<string, string>} Parsed cookies object with null prototype
 */
export const parseCookies = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return Object.create(null);
  }

  const cookies = Object.create(null);
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;

    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();

    // Reject invalid or empty cookie names
    if (!key || !COOKIE_NAME_REGEX.test(key)) {
      continue;
    }

    // Detect duplicate sensitive authentication cookies and fail closed
    if (SENSITIVE_AUTH_COOKIES.has(key) && key in cookies) {
      throw new AppError(
        'BAD_REQUEST',
        'Duplicate authentication cookies detected',
        400
      );
    }

    // Preserve the first occurrence for non-sensitive cookies (RFC 6265 path specificity)
    if (key in cookies) {
      continue;
    }

    let decodedVal = val;
    try {
      decodedVal = decodeURIComponent(val);
    } catch {
      decodedVal = val;
    }

    cookies[key] = decodedVal;
  }

  return cookies;
};

/**
 * Express middleware attaching parsed cookies to `req.cookies`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const cookieParserMiddleware = (req, res, next) => {
  try {
    req.cookies = parseCookies(req.headers.cookie);
    next();
  } catch (err) {
    next(err);
  }
};
