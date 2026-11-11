import { AppError } from '../utils/app-error.js';

/**
 * Centralized, safe error-handling middleware.
 * Guarantees that:
 * - All responses adhere to the standard { error: { code, message, details } } envelope.
 * - Unexpected errors always return generic INTERNAL_SERVER_ERROR without exposing internal messages or stack traces.
 * - Recognized operational errors preserve meaningful messages and status codes.
 * - Untrusted properties on errors cannot override or corrupt the contract.
 * - Useful error logging is preserved on the server.
 */
export const errorHandler = (err, req, res, next) => {
  // 1. Malformed JSON payload from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON in request body',
        details: [],
      },
    });
  }

  // 2. Oversized payload from express.json({ limit })
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds size limit',
        details: [],
      },
    });
  }

  // 3. Recognized operational errors (AppError)
  if (err instanceof AppError && err.isOperational) {
    const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode <= 599
      ? err.statusCode
      : 500;

    // Operational errors marked 5xx must still present a sanitized envelope to the client
    if (statusCode >= 500) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[Server Error] Operational 5xx error:', err);
      }
      return res.status(statusCode).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: [],
        },
      });
    }

    const code = typeof err.code === 'string' && /^[A-Z0-9_]+$/.test(err.code)
      ? err.code
      : 'BAD_REQUEST';

    const message = typeof err.message === 'string' && err.message.length > 0
      ? err.message
      : 'An error occurred';

    const details = Array.isArray(err.details) ? err.details : [];

    return res.status(statusCode).json({
      error: {
        code,
        message,
        details,
      },
    });
  }

  // 4. Unexpected internal errors (TypeErrors, database driver bugs, unhandled exceptions)
  // Server-side logging preserves diagnostic context
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Server Error] Unhandled internal exception:', err);
  }

  // Client receives strictly generic 500 response in all environments (including development)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      details: [],
    },
  });
};
