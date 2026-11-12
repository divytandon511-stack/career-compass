import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, ALLOWED_ROLES } from '../utils/jwt.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import {
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_LIFETIME_MS,
} from '../utils/token.js';

/**
 * Precomputed synthetic Argon2id password hash with identical OWASP cost parameters:
 * m=65536, t=3, p=4, 32-byte digest ($argon2id$v=19$m=65536,t=3,p=4$).
 * Used to normalize CPU verification latency for unknown email addresses, eliminating
 * the timing side-channel that allows user account enumeration.
 */
export const SYNTHETIC_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$1r9D9I3GAvYw1NMt/m48+w$8SRf/4IKUT7ClAXPSMcoqPjIYuxGsN5R8U8UFhe4+Mk';

/**
 * Format Zod validation errors to match docs/api-contract.md §1 standard envelope.
 *
 * @param {import('zod').ZodError} error
 * @returns {Array<{ field: string, issue: string }>}
 */
const formatZodIssues = (error) => {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    issue: issue.message,
  }));
};

/**
 * Authentication business-logic service.
 * Implements registration, login, atomic refresh-token rotation, reuse detection, and logout.
 * Uses injected authRepository; never accesses raw database or runtime in-memory tables directly.
 */
export class AuthService {
  /**
   * @param {object} dependencies
   * @param {import('../repositories/auth.repository.interface.js').AuthRepositoryInterface} dependencies.authRepository
   * @param {number} [dependencies.rotationGraceWindowMs=5000] - Window (ms) in which a rotated token is rejected without family revocation
   * @param {() => number} [dependencies.getCurrentTime=() => Date.now()] - Injected clock for deterministic temporal testing
   * @param {string} [dependencies.syntheticPasswordHash=SYNTHETIC_ARGON2_HASH] - Precomputed Argon2id hash for unknown-user timing parity
   */
  constructor({
    authRepository,
    rotationGraceWindowMs = 5000,
    getCurrentTime = () => Date.now(),
    syntheticPasswordHash = SYNTHETIC_ARGON2_HASH,
  } = {}) {
    if (!authRepository) {
      throw new Error('AuthService requires an authRepository dependency');
    }
    this.authRepository = authRepository;
    this.rotationGraceWindowMs = rotationGraceWindowMs;
    this.getCurrentTime = getCurrentTime;
    this.syntheticPasswordHash = syntheticPasswordHash;
  }

  /**
   * Registers a new student account.
   *
   * Business Rules:
   * 1. Validates payload using registerSchema (enforcing UTF-8 byte limits, required consent).
   * 2. Normalizes email to lowercase.
   * 3. Prevents duplicate email registration (409 Conflict).
   * 4. Hashes password using Argon2id with OWASP-recommended parameters.
   * 5. Enforces role STUDENT and status ACTIVE only. Rejects self-assigned privileged roles.
   * 6. Preserves student consent flags for later institutional verification.
   * 7. Excludes passwords, hashes, and internal metadata from returned user response.
   *
   * @param {object} payload - Raw registration payload
   * @returns {Promise<{ user: { id: string, email: string, role: string } }>}
   */
  async register(payload) {
    const validation = registerSchema.safeParse(payload);
    if (!validation.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Please correct the supplied fields.',
        422,
        formatZodIssues(validation.error)
      );
    }

    const { email, password, displayName, schoolGrade, consentAccepted } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing account with same normalized email
    const existingUser = await this.authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('CONFLICT', 'An account with this email already exists', 409);
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Persist user and student profile atomically through repository
    let createdUser;
    try {
      createdUser = await this.authRepository.createStudentUser({
        email: normalizedEmail,
        passwordHash,
        displayName,
        schoolGrade: schoolGrade || null,
        consentAccepted,
      });
    } catch (err) {
      // Handle potential database-level unique constraint collision in concurrent registrations
      if (err.code === 'P2002' || err.code === 'CONFLICT') {
        throw new AppError('CONFLICT', 'An account with this email already exists', 409);
      }
      throw err;
    }

    if (!createdUser || !createdUser.id) {
      throw new Error('Failed to create student account');
    }

    // Return sanitized envelope without exposing passwordHash or internal fields
    return {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role, // Guaranteed 'STUDENT'
      },
    };
  }

  /**
   * Authenticates a user with email and password.
   *
   * Timing-Safe Anti-Enumeration Design:
   * 1. Validates credentials format with loginSchema.
   * 2. Looks up user by normalized lowercase email.
   * 3. For nonexistent accounts or missing password hashes, performs a dummy Argon2id verification
   *    against SYNTHETIC_ARGON2_HASH before returning the generic 401 response.
   * 4. Ensures observable computation latency is balanced between known and unknown accounts.
   * 5. Returns generic 'Invalid email or password' for both cases.
   * 6. Enforces account status ACTIVE (rejects suspended accounts with 401).
   * 7. Issues short-lived JWT access token (15-minute TTL).
   * 8. Generates high-entropy opaque refresh token (256-bit).
   * 9. Hashes refresh token with SHA-256 before persisting session in repository.
   *
   * @param {object} credentials - Raw login payload
   * @returns {Promise<{ accessToken: string, expiresIn: number, refreshToken: string, user: { id: string, email: string, role: string } }>}
   */
  async login(credentials) {
    const validation = loginSchema.safeParse(credentials);
    if (!validation.success) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Please correct the supplied fields.',
        422,
        formatZodIssues(validation.error)
      );
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Query user by normalized email
    const user = await this.authRepository.findUserByEmail(normalizedEmail);

    // Timing-Safe Execution: if user does not exist or has no passwordHash,
    // evaluate the candidate password against the precomputed synthetic Argon2id hash.
    const targetHash = user?.passwordHash || this.syntheticPasswordHash;
    const isValidPassword = await verifyPassword(targetHash, password);

    // Fail closed if user was nonexistent, hash was absent, or password check failed
    if (!user || !user.passwordHash || !isValidPassword) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    // Enforce active account status
    if (user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHORIZED', 'User account is suspended', 401);
    }

    // Validate authoritative role belongs to allowlist
    if (!user.role || !ALLOWED_ROLES.includes(user.role)) {
      throw new AppError('UNAUTHORIZED', 'User account has an invalid or unrecognized role', 401);
    }

    // Issue short-lived JWT access token (900 seconds)
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Generate cryptographically secure opaque refresh token (256 bits)
    const rawRefreshToken = generateOpaqueToken(32);
    const hashedTokenId = hashToken(rawRefreshToken);
    const expiresAt = new Date(this.getCurrentTime() + REFRESH_TOKEN_LIFETIME_MS);

    // Persist refresh session (stores only hashedTokenId, never plaintext)
    await this.authRepository.createRefreshSession({
      userId: user.id,
      hashedTokenId,
      expiresAt,
      rotatedFrom: null,
    });

    return {
      accessToken,
      expiresIn: 900,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Rotates a refresh token and issues a new access token.
   *
   * Conservative Concurrency & Replay Policy:
   * 1. Requires a 64-character hex format for the raw refresh token.
   * 2. Exactly one concurrent rotation succeeds atomically.
   * 3. The losing concurrent request never receives a replacement token.
   * 4. A recently rotated token (revokedReason === 'TOKEN_ROTATION' or 'ROTATED'), within
   *    rotationGraceWindowMs (default 5000ms), is rejected with 401 UNAUTHORIZED without
   *    revoking the token family (protecting parallel client tab races).
   * 5. A rotated token presented outside the grace window triggers full family revocation.
   * 6. Tokens revoked for logout, compromise, suspension, or expiration are NEVER treated as harmless
   *    concurrency and never enter the grace window or trigger family revocation.
   * 7. Re-verifies authoritative user existence, ACTIVE status, and role before issuing replacement tokens.
   *
   * Security Tradeoff Documentation:
   * Replays within the 5-second grace window are denied access without triggering immediate family
   * revocation. This avoids accidental denial-of-service in browsers with parallel component queries,
   * while strictly ensuring no replacement token is ever returned to a replayed token.
   *
   * @param {string} rawRefreshToken - Raw plaintext refresh token presented by client
   * @returns {Promise<{ accessToken: string, expiresIn: number, refreshToken: string }>}
   */
  async refresh(rawRefreshToken) {
    if (
      typeof rawRefreshToken !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(rawRefreshToken.trim())
    ) {
      throw new AppError('UNAUTHORIZED', 'Invalid or malformed refresh token', 401);
    }

    const hashedTokenId = hashToken(rawRefreshToken);

    // Lookup session by hashed token
    const session = await this.authRepository.findRefreshSessionByHashedToken(hashedTokenId);
    if (!session) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token', 401);
    }

    // Handle already-revoked sessions
    if (session.revokedAt !== null && session.revokedAt !== undefined) {
      // Authoritative check: only explicit token rotation reasons qualify for concurrency grace
      const isRotation =
        session.revokedReason === 'TOKEN_ROTATION' || session.revokedReason === 'ROTATED';

      if (isRotation) {
        const now = this.getCurrentTime();
        const revokedAtTime = new Date(session.revokedAt).getTime();
        const elapsedMs = now - revokedAtTime;

        if (elapsedMs >= 0 && elapsedMs <= this.rotationGraceWindowMs) {
          // Concurrency race: within grace period, reject without revoking family
          throw new AppError(
            'UNAUTHORIZED',
            'Refresh token was recently rotated; please use the new token',
            401
          );
        }

        // Replay of rotated token outside grace window: confirmed token reuse
        await this.authRepository.revokeRefreshSessionFamily({
          sessionId: session.id,
          userId: session.userId,
        });

        throw new AppError(
          'UNAUTHORIZED',
          'Invalid refresh token session: token reuse detected',
          401
        );
      }

      // Non-rotation revocations (LOGOUT, ALL_DEVICES_LOGOUT, TOKEN_REUSE_DETECTED, REUSE_DETECTED,
      // ACCOUNT_SUSPENDED, SECURITY_RESET, EXPIRED, null, unknown):
      // Fail closed with 401 without grace and without unnecessary family revocation
      if (session.revokedReason === 'EXPIRED') {
        throw new AppError('UNAUTHORIZED', 'Refresh token has expired', 401);
      }

      throw new AppError(
        'UNAUTHORIZED',
        'Refresh token has been revoked or is no longer valid',
        401
      );
    }

    // Expiry check (7 days)
    if (this.getCurrentTime() >= new Date(session.expiresAt).getTime()) {
      await this.authRepository.revokeRefreshSession(session.id, 'EXPIRED');
      throw new AppError('UNAUTHORIZED', 'Refresh token has expired', 401);
    }

    // Validate current authoritative user status and role
    const user = await this.authRepository.findUserById(session.userId);
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User account not found', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHORIZED', 'User account is suspended', 401);
    }

    if (!user.role || !ALLOWED_ROLES.includes(user.role)) {
      throw new AppError('UNAUTHORIZED', 'User account has an invalid or unrecognized role', 401);
    }

    // Generate replacement refresh token
    const newRawRefreshToken = generateOpaqueToken(32);
    const newHashedTokenId = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(this.getCurrentTime() + REFRESH_TOKEN_LIFETIME_MS);

    // Atomically rotate session in repository
    const rotatedSession = await this.authRepository.rotateRefreshSession({
      oldSessionId: session.id,
      newHashedTokenId,
      newExpiresAt,
      userId: user.id,
    });

    if (!rotatedSession) {
      // Concurrent race or failed rotation: fail closed, never issue tokens
      throw new AppError('UNAUTHORIZED', 'Refresh token rotation failed', 401);
    }

    // Issue fresh access token with current authoritative role
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      expiresIn: 900,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Logs out a session or all active sessions for a user.
   *
   * Trusted Identity Binding Requirements:
   * - Stage 4 controllers MUST supply `authenticatedUserId` strictly from verified `req.user.id`.
   * - Never pass an unverified user ID from query strings, route params, or request bodies.
   * - If allDevices=true, the target user is derived from `authenticatedUserId` or a verified active
   *   refresh session; it throws 401 if insufficient authentication context is supplied and never
   *   silently falls back to single-session logout.
   * - Cross-user revocation attempts (where `authenticatedUserId !== session.userId`) are rejected
   *   with 403 FORBIDDEN.
   *
   * @param {object} params
   * @param {string} [params.refreshToken] - Raw refresh token from cookie
   * @param {string} [params.authenticatedUserId] - Trusted user UUID from req.user.id
   * @param {boolean} [params.allDevices=false] - Whether to revoke all active sessions
   * @returns {Promise<{ success: true }>}
   */
  async logout({ refreshToken, authenticatedUserId, allDevices = false } = {}) {
    // Validate authenticatedUserId format if provided
    if (authenticatedUserId !== undefined && authenticatedUserId !== null) {
      if (
        typeof authenticatedUserId !== 'string' ||
        !z.string().uuid().safeParse(authenticatedUserId.trim()).success
      ) {
        throw new AppError('UNAUTHORIZED', 'Invalid authenticated identity', 401);
      }
    }

    let hashedTokenId = null;
    let session = null;

    if (refreshToken !== undefined && refreshToken !== null) {
      if (
        typeof refreshToken !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(refreshToken.trim())
      ) {
        throw new AppError('UNAUTHORIZED', 'Invalid or malformed refresh token', 401);
      }
      hashedTokenId = hashToken(refreshToken);
      session = await this.authRepository.findRefreshSessionByHashedToken(hashedTokenId);
    }

    // Prevent cross-user session revocation
    if (authenticatedUserId && session && session.userId) {
      if (session.userId.trim().toLowerCase() !== authenticatedUserId.trim().toLowerCase()) {
        throw new AppError('FORBIDDEN', 'Authentication identity does not match refresh session', 403);
      }
    }

    // All-device logout flow
    if (allDevices) {
      const targetUserId = authenticatedUserId || (session?.revokedAt === null ? session?.userId : null);

      if (!targetUserId) {
        throw new AppError(
          'UNAUTHORIZED',
          'Authentication context or verified active refresh session is required for all-device logout',
          401
        );
      }

      await this.authRepository.revokeAllUserSessions(targetUserId);
      return { success: true };
    }

    // Single-device logout flow
    if (hashedTokenId) {
      await this.authRepository.revokeSessionByHashedToken(hashedTokenId);
      return { success: true };
    }

    throw new AppError('BAD_REQUEST', 'Refresh token is required for single-session logout', 400);
  }
}

/**
 * Factory helper for AuthService instantiation.
 *
 * @param {object} dependencies
 * @param {import('../repositories/auth.repository.interface.js').AuthRepositoryInterface} dependencies.authRepository
 * @returns {AuthService}
 */
export const createAuthService = (dependencies) => new AuthService(dependencies);
