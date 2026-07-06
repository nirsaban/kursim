import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'password too short')
  .max(128, 'password too long');

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
  // absent → super-admin login
  tenantSlug: z.string().min(1).max(64).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const courseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const moduleSchema = z.object({
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
});

export const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(20000).nullish(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createStudentSchema = z.object({
  email: z.string().email().max(320),
  password: passwordSchema,
  role: z.enum(['STUDENT', 'INSTRUCTOR']).default('STUDENT'),
  courseIds: z.array(z.string().uuid()).optional(),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const inviteSchema = z.object({
  email: z.string().email().max(320).nullish(),
  role: z.enum(['STUDENT', 'INSTRUCTOR']).default('STUDENT'),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(16).max(128),
  email: z.string().email().max(320),
  password: passwordSchema,
});

export const tenantSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sessionLimit: z.number().int().min(1).max(20).optional(),
  evictionPolicy: z.enum(['BLOCK', 'EVICT_OLDEST']).optional(),
});

export const createTenantSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  name: z.string().min(1).max(200),
  ownerEmail: z.string().email().max(320),
  ownerPassword: passwordSchema,
  sessionLimit: z.number().int().min(1).max(20).default(3),
  evictionPolicy: z.enum(['BLOCK', 'EVICT_OLDEST']).default('BLOCK'),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  sessionLimit: z.number().int().min(1).max(20).optional(),
  evictionPolicy: z.enum(['BLOCK', 'EVICT_OLDEST']).optional(),
});

export const progressSchema = z.object({
  lessonId: z.string().uuid(),
  lastPositionSec: z.number().int().min(0),
  completed: z.boolean().optional(),
});

export const enrollSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export const reviewSchema = z.object({
  name: z.string().max(100).default(''),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(3).max(1000),
  privateNote: z.string().max(1000).default(''),
});

/** Owner moderation: edit and/or approve a submitted review. */
export const reviewModerationSchema = z.object({
  approved: z.boolean().optional(),
  name: z.string().max(100).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  text: z.string().min(3).max(1000).optional(),
});

export const signUploadSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(['video', 'image', 'raw']),
});

export const attachMediaSchema = z.object({
  publicId: z.string().min(1).max(512),
  durationSec: z.number().int().min(0).nullish(),
  bytes: z.number().int().min(0).nullish(),
});
