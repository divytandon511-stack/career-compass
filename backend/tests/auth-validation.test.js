import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  ALLOWED_SCHOOL_GRADES,
} from '../src/validators/auth.validator.js';

describe('Authentication & Profile Validation Schemas', () => {
  describe('Registration Schema (registerSchema)', () => {
    const validRegistrationData = {
      email: 'student.demo@example.test',
      password: 'StrongPassword123!',
      displayName: 'Aarav Sharma',
      schoolGrade: '10',
      consentAccepted: true,
    };

    it('successfully parses a valid registration payload with optional grade', () => {
      const result = registerSchema.safeParse(validRegistrationData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('student.demo@example.test');
        expect(result.data.displayName).toBe('Aarav Sharma');
        expect(result.data.schoolGrade).toBe('10');
        expect(result.data.consentAccepted).toBe(true);
      }
    });

    it('successfully parses a valid registration payload without optional grade', () => {
      const { schoolGrade, ...withoutGrade } = validRegistrationData;
      const result = registerSchema.safeParse(withoutGrade);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schoolGrade).toBeUndefined();
      }
    });

    it('normalizes email to lowercase and trims surrounding whitespace', () => {
      const result = registerSchema.safeParse({
        ...validRegistrationData,
        email: '  STUDENT.CAPS@EXAMPLE.TEST  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('student.caps@example.test');
      }
    });

    it('rejects invalid email formats', () => {
      const result = registerSchema.safeParse({
        ...validRegistrationData,
        email: 'invalid-email-without-at',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('enforces password minimum length of 12 characters', () => {
      // 11 characters: should fail
      const shortPasswordResult = registerSchema.safeParse({
        ...validRegistrationData,
        password: 'Short12345!',
      });
      expect(shortPasswordResult.success).toBe(false);

      // Exactly 12 characters: should succeed
      const boundaryPasswordResult = registerSchema.safeParse({
        ...validRegistrationData,
        password: 'Valid12Chars',
      });
      expect(boundaryPasswordResult.success).toBe(true);
    });

    it('enforces password maximum size of 128 UTF-8 bytes', () => {
      // 128 bytes ASCII: should succeed
      const valid128Bytes = 'a'.repeat(128);
      const boundaryResult = registerSchema.safeParse({
        ...validRegistrationData,
        password: valid128Bytes,
      });
      expect(boundaryResult.success).toBe(true);

      // 129 bytes ASCII: should fail
      const invalid129Bytes = 'a'.repeat(129);
      const overflowResult = registerSchema.safeParse({
        ...validRegistrationData,
        password: invalid129Bytes,
      });
      expect(overflowResult.success).toBe(false);
      if (!overflowResult.success) {
        expect(overflowResult.error.issues[0].message).toContain('128 bytes');
      }

      // Multi-byte characters: 33 4-byte emojis = 132 bytes (> 128 bytes)
      const emojiPassword = '🔒'.repeat(33);
      expect(Buffer.byteLength(emojiPassword, 'utf8')).toBe(132);
      const multiByteResult = registerSchema.safeParse({
        ...validRegistrationData,
        password: emojiPassword,
      });
      expect(multiByteResult.success).toBe(false);
    });

    it('enforces displayName length between 1 and 100 characters', () => {
      // Empty string after trim
      const emptyResult = registerSchema.safeParse({
        ...validRegistrationData,
        displayName: '   ',
      });
      expect(emptyResult.success).toBe(false);

      // Exceeds 100 characters
      const tooLongResult = registerSchema.safeParse({
        ...validRegistrationData,
        displayName: 'A'.repeat(101),
      });
      expect(tooLongResult.success).toBe(false);
    });

    it('restricts schoolGrade to grades 9–12 and normalizes "th" suffixes', () => {
      for (const grade of ALLOWED_SCHOOL_GRADES) {
        const canonicalResult = registerSchema.safeParse({
          ...validRegistrationData,
          schoolGrade: grade,
        });
        expect(canonicalResult.success).toBe(true);
        if (canonicalResult.success) {
          expect(canonicalResult.data.schoolGrade).toBe(grade);
        }

        const suffixResult = registerSchema.safeParse({
          ...validRegistrationData,
          schoolGrade: `${grade}th`,
        });
        expect(suffixResult.success).toBe(true);
        if (suffixResult.success) {
          expect(suffixResult.data.schoolGrade).toBe(grade);
        }
      }

      // Invalid grades outside 9-12
      for (const invalidGrade of ['8', '13', 'kindergarten', 'college']) {
        const invalidResult = registerSchema.safeParse({
          ...validRegistrationData,
          schoolGrade: invalidGrade,
        });
        expect(invalidResult.success).toBe(false);
      }
    });

    it('strictly requires consentAccepted === true', () => {
      const falseResult = registerSchema.safeParse({
        ...validRegistrationData,
        consentAccepted: false,
      });
      expect(falseResult.success).toBe(false);

      const missingResult = registerSchema.safeParse({
        ...validRegistrationData,
        consentAccepted: undefined,
      });
      expect(missingResult.success).toBe(false);
    });

    it('strictly rejects unknown properties (role, status, id, passwordHash)', () => {
      const injectedPayload = {
        ...validRegistrationData,
        role: 'ADMIN',
        status: 'ACTIVE',
        id: '11111111-1111-1111-1111-111111111111',
        passwordHash: '$argon2id$...',
      };

      const result = registerSchema.safeParse(injectedPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const unrecognizedKeys = result.error.issues.flatMap((i) => i.keys || i.path);
        expect(unrecognizedKeys).toContain('role');
      }
    });
  });

  describe('Login Schema (loginSchema)', () => {
    it('successfully parses a valid login payload with normalized email', () => {
      const result = loginSchema.safeParse({
        email: '  STUDENT@EXAMPLE.TEST  ',
        password: 'AnyPassword123!',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('student@example.test');
        expect(result.data.password).toBe('AnyPassword123!');
      }
    });

    it('rejects missing or empty email', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'ValidPassword123!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing or empty password', () => {
      const result = loginSchema.safeParse({
        email: 'student@example.test',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('strictly rejects unknown properties in login', () => {
      const result = loginSchema.safeParse({
        email: 'student@example.test',
        password: 'ValidPassword123!',
        rememberMe: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Profile Update Schema (updateProfileSchema)', () => {
    it('successfully parses valid displayName update', () => {
      const result = updateProfileSchema.safeParse({
        displayName: 'Aarav Updated',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe('Aarav Updated');
      }
    });

    it('successfully parses valid schoolGrade update', () => {
      const result = updateProfileSchema.safeParse({
        schoolGrade: '11th',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schoolGrade).toBe('11');
      }
    });

    it('rejects empty object update payloads', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one field');
      }
    });

    it('strictly rejects attempts to alter role, email, status, or id', () => {
      const result = updateProfileSchema.safeParse({
        displayName: 'New Name',
        role: 'COUNSELLOR',
        status: 'ACTIVE',
        email: 'hacked@example.test',
      });
      expect(result.success).toBe(false);
    });
  });
});
