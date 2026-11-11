import { z } from 'zod';

/**
 * Valid school grades for secondary & higher secondary education in India (Grades 9–12).
 * Normalizes inputs like '9th', '10th', '11th', '12th' to canonical '9', '10', '11', '12'.
 */
export const ALLOWED_SCHOOL_GRADES = ['9', '10', '11', '12'];

export const emailSchema = z
  .string({ required_error: 'Email is required', invalid_type_error: 'Email must be a string' })
  .trim()
  .min(1, { message: 'Email cannot be empty' })
  .max(255, { message: 'Email cannot exceed 255 characters' })
  .email({ message: 'Invalid email address' })
  .transform((val) => val.toLowerCase());

export const passwordSchema = z
  .string({ required_error: 'Password is required', invalid_type_error: 'Password must be a string' })
  .min(12, { message: 'Password must be at least 12 characters long' })
  .refine((val) => Buffer.byteLength(val, 'utf8') <= 128, {
    message: 'Password cannot exceed 128 bytes',
  });

export const displayNameSchema = z
  .string({ required_error: 'Display name is required', invalid_type_error: 'Display name must be a string' })
  .trim()
  .min(1, { message: 'Display name cannot be empty' })
  .max(100, { message: 'Display name cannot exceed 100 characters' });

export const schoolGradeSchema = z
  .string({ invalid_type_error: 'schoolGrade must be a string' })
  .trim()
  .transform((val) => val.replace(/th$/i, ''))
  .refine((val) => ALLOWED_SCHOOL_GRADES.includes(val), {
    message: 'schoolGrade must be one of: 9, 10, 11, 12 (or 9th, 10th, 11th, 12th)',
  });

/**
 * Registration request payload schema.
 * Strict: Rejects unknown fields (e.g. role, status, id, passwordHash).
 */
export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
    schoolGrade: schoolGradeSchema.optional(),
    consentAccepted: z.literal(true, {
      errorMap: () => ({ message: 'consentAccepted must be true' }),
    }),
  })
  .strict({ message: 'Unrecognized properties are not permitted in registration' });

/**
 * Login request payload schema.
 * Strict: Rejects unknown fields.
 */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z
      .string({ required_error: 'Password is required', invalid_type_error: 'Password must be a string' })
      .min(1, { message: 'Password is required' }),
  })
  .strict({ message: 'Unrecognized properties are not permitted in login' });

/**
 * Profile update request payload schema (PATCH /users/me).
 * Strict: Rejects unknown fields.
 * Refine: Requires at least one field to be present.
 */
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    schoolGrade: schoolGradeSchema.optional(),
  })
  .strict({ message: 'Unrecognized properties are not permitted in profile update' })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (displayName or schoolGrade) must be provided for update',
  });
