import { Dimension } from './dimensions';

export type UserRole = 'STUDENT' | 'COUNSELLOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

/**
 * Minimal authenticated user identity returned by JWT tokens and /auth/* endpoints
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

/**
 * Full user profile returned by /users/me
 */
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  profile: StudentProfile | CounsellorProfile | null;
  createdAt: string;
  updatedAt?: string;
}

// Backward-compatibility alias
export type User = UserProfile;

export interface StudentProfile {
  userId: string;
  schoolGrade?: string | null;
  schoolId?: string | null;
  consentAccepted: boolean;
}

export interface CounsellorProfile {
  userId: string;
  displayName: string;
  bio?: string | null;
  active: boolean;
}

export interface Career {
  id: string;
  slug: string;
  title: string;
  description: string;
  published: boolean;
  profileVersion: number | string;
  dimensions?: {
    dimension: Dimension;
    targetWeight: number;
  }[];
  skills?: Array<{ id: string; name: string }>;
  pathways?: Array<{ id: string; stage: string; qualification: string; notes?: string }>;
  savedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedCareer extends Career {
  savedAt: string;
}

export interface AssessmentAttempt {
  id: string;
  studentId?: string;
  assessmentId: string;
  assessmentVersion?: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  completedAt?: string | null;
  scoresJson?: Record<string, number> | null;
  algorithmVersion?: string | null;
  answers?: Array<{
    questionId: string;
    selectedOptionId: string;
    answeredAt: string;
  }>;
  recommendationsUrl?: string;
}

export interface RecommendationCareer {
  id: string;
  slug: string;
  title: string;
  description?: string;
}

export interface Recommendation {
  career: RecommendationCareer;
  rank: number;
  similarityScore: number; // 0.0 - 1.0 (Cosine similarity)
  algorithmVersion?: string;
  careerProfileVersion?: number;
  reasons: string[];
  cautions: string[];
  // Compatibility fields
  id?: string;
  score?: number;
}

export interface AvailabilitySlot {
  id: string;
  counsellorId: string;
  startsAt: string;
  endsAt: string;
  status: 'AVAILABLE' | 'BOOKED' | 'CANCELLED';
}

export interface Booking {
  id: string;
  slotId: string;
  studentId: string;
  counsellorId: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  note?: string | null;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt?: string;
  notificationStatus?: string;
  slot?: AvailabilitySlot;
  counsellor?: CounsellorProfile;
}
