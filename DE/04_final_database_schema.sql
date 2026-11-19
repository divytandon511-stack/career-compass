-- ============================================================================
-- CareerCompass — Final Database Schema (PostgreSQL DDL)
-- ============================================================================
-- Component: Data Engineering Deliverable #4
-- Database Engine: PostgreSQL 16
-- Normalization Level: Third Normal Form (3NF)
-- ORM Mapping: Prisma ORM (schema.prisma)
-- ============================================================================

-- Enable UUID extension for cryptographic key generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENUMERATION TYPES
-- ----------------------------------------------------------------------------

CREATE TYPE "Role" AS ENUM ('STUDENT', 'COUNSELLOR', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
CREATE TYPE "Dimension" AS ENUM ('ANALYTICAL', 'CREATIVE', 'SOCIAL', 'PRACTICAL', 'ORGANIZATIONAL', 'INVESTIGATIVE');
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'CANCELLED');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "RevokedReason" AS ENUM (
    'TOKEN_ROTATION', 'ROTATED', 'LOGOUT', 'ALL_DEVICES_LOGOUT',
    'TOKEN_REUSE_DETECTED', 'REUSE_DETECTED', 'ACCOUNT_SUSPENDED',
    'SECURITY_RESET', 'EXPIRED'
);

-- ----------------------------------------------------------------------------
-- 2. USER & AUTHENTICATION TABLES
-- ----------------------------------------------------------------------------

-- Master Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role "Role" NOT NULL DEFAULT 'STUDENT',
    status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Student Profiles (1:1 with users)
CREATE TABLE student_profiles (
    user_id UUID PRIMARY KEY,
    school_grade VARCHAR(10),
    consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Counsellor Profiles (1:1 with users)
CREATE TABLE counsellor_profiles (
    user_id UUID PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_counsellor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Refresh Token Rotation Sessions (1:N with users)
CREATE TABLE refresh_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    hashed_token_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_reason "RevokedReason",
    rotated_from UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_refresh_hashed_token UNIQUE (hashed_token_id),
    CONSTRAINT uq_refresh_rotated_from UNIQUE (rotated_from),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_predecessor FOREIGN KEY (rotated_from) REFERENCES refresh_sessions(id) ON DELETE RESTRICT
);
CREATE INDEX idx_refresh_sessions_user_id ON refresh_sessions(user_id);

-- ----------------------------------------------------------------------------
-- 3. ASSESSMENT & SCORING TABLES
-- ----------------------------------------------------------------------------

-- Assessment Definitions
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    status "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_assessments_status ON assessments(status);

-- Assessment Question Bank (30 questions per published version)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    dimension "Dimension" NOT NULL,
    prompt TEXT NOT NULL,
    position INT NOT NULL,
    weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0000,
    options JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_position UNIQUE (assessment_id, position),
    CONSTRAINT fk_question_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- Student Assessment Attempts
CREATE TABLE assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    assessment_version INT NOT NULL,
    status "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    scores_json JSONB,
    algorithm_version VARCHAR(50),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_attempt_student FOREIGN KEY (student_id) REFERENCES student_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_attempt_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT
);
CREATE INDEX idx_attempts_student_id ON assessment_attempts(student_id);
CREATE INDEX idx_attempts_assessment_id ON assessment_attempts(assessment_id);
CREATE INDEX idx_attempts_status ON assessment_attempts(status);

-- Student Answers per Question
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_option_id VARCHAR(36) NOT NULL,
    score INT NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT fk_answer_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_answer_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- 4. CAREER TAXONOMY & RECOMMENDATIONS
-- ----------------------------------------------------------------------------

-- Curated Career Catalog
CREATE TABLE careers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    profile_version INT NOT NULL DEFAULT 1,
    source_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_careers_slug UNIQUE (slug)
);
CREATE INDEX idx_careers_published ON careers(published);

-- Career Canonical Target Dimensions
CREATE TABLE career_dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    career_id UUID NOT NULL,
    dimension "Dimension" NOT NULL,
    target_weight DECIMAL(5, 4) NOT NULL,
    CONSTRAINT uq_career_dimension UNIQUE (career_id, dimension),
    CONSTRAINT fk_dimension_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
);

-- Transversal Skills
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_skills_name UNIQUE (name)
);

-- Career Skills Junction (M:N)
CREATE TABLE career_skills (
    career_id UUID NOT NULL,
    skill_id UUID NOT NULL,
    PRIMARY KEY (career_id, skill_id),
    CONSTRAINT fk_career_skills_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE,
    CONSTRAINT fk_career_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- Educational Pathways Blueprints (1:N)
CREATE TABLE education_pathways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    career_id UUID NOT NULL,
    stage VARCHAR(50) NOT NULL,
    qualification VARCHAR(200) NOT NULL,
    notes TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pathway_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
);

-- Mathematical Recommendations per Completed Attempt
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    career_id UUID NOT NULL,
    rank INT NOT NULL,
    similarity_score DECIMAL(7, 6) NOT NULL,
    explanation_json JSONB,
    algorithm_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attempt_career UNIQUE (attempt_id, career_id),
    CONSTRAINT fk_recommendation_attempt FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendation_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE RESTRICT
);

-- Saved / Bookmarked Careers (M:N)
CREATE TABLE saved_careers (
    student_id UUID NOT NULL,
    career_id UUID NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, career_id),
    CONSTRAINT fk_saved_student FOREIGN KEY (student_id) REFERENCES student_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_career FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 5. COUNSELLOR AVAILABILITY & CONFLICT-FREE BOOKINGS
-- ----------------------------------------------------------------------------

-- Counsellor Time Availability Slots
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counsellor_id UUID NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_slot_counsellor FOREIGN KEY (counsellor_id) REFERENCES counsellor_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_slot_duration CHECK (ends_at > starts_at)
);
CREATE INDEX idx_slots_counsellor_starts ON availability_slots(counsellor_id, starts_at);
CREATE INDEX idx_slots_status ON availability_slots(status);

-- Student Appointments / Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    counsellor_id UUID NOT NULL,
    slot_id UUID NOT NULL,
    status "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_student FOREIGN KEY (student_id) REFERENCES student_profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_counsellor FOREIGN KEY (counsellor_id) REFERENCES counsellor_profiles(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_slot FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE RESTRICT
);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX idx_bookings_student_id ON bookings(student_id);
CREATE INDEX idx_bookings_counsellor_id ON bookings(counsellor_id);

-- Asynchronous Transactional Email Outbox
CREATE TABLE email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    idempotency_key VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_outbox_idempotency UNIQUE (idempotency_key)
);
CREATE INDEX idx_outbox_status_next ON email_outbox(status, next_attempt_at);

-- ============================================================================
-- 6. MONGODB COLLECTION STRUCTURE (Mongoose Definition)
-- ============================================================================
/*
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  groundingCareerIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const guidanceSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  attemptId: { type: String, required: true },
  careerIds: { type: [String], required: true },
  messages: { type: [messageSchema], default: [] },
  model: { type: String, required: true },
  consentVersion: { type: String, required: true, default: 'v1' }
}, { timestamps: true, collection: 'guidance_sessions' });

guidanceSessionSchema.index({ studentId: 1, updatedAt: -1 });
*/
