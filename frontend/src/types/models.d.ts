import { Dimension } from './dimensions';

export type UserRole = 'STUDENT' | 'COUNSELLOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface StudentProfile {
  userId: string;
  schoolGrade?: string;
  schoolId?: string;
  consentAccepted: boolean;
}

export interface CounsellorProfile {
  userId: string;
  displayName: string;
  bio?: string;
  active: boolean;
}

export interface Career {
  id: string;
  slug: string;
  title: string;
  description: string;
  published: boolean;
  profileVersion: string;
  dimensions?: {
    dimension: Dimension;
    targetWeight: number;
  }[];
}

export interface AssessmentAttempt {
  id: string;
  studentId: string;
  assessmentId: string;
  version: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  completedAt?: string;
  scoresJson?: Record<string, number>;
}

export interface Recommendation {
  id: string;
  attemptId: string;
  careerId: string;
  rank: number;
  score: number; // 0.0 - 1.0 (Cosine similarity)
  explanationJson?: {
    reasons?: string[];
    cautions?: string[];
    dimensionSnapshot?: Record<string, number>;
  };
  career?: Career;
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
  studentId: string;
  counsellorId: string;
  slotId: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  note?: string;
  createdAt: string;
  slot?: AvailabilitySlot;
  counsellor?: CounsellorProfile;
}
