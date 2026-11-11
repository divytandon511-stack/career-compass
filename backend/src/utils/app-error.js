export class AppError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g. 'NOT_FOUND', 'VALIDATION_ERROR')
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {Array} [details=[]] - Optional array of granular error details
   */
  constructor(code, message, statusCode = 500, details = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

