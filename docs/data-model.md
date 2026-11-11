# CareerCompass — Data Model

**Status:** Proposed design, not implemented  
**Version:** 1.0 · 11 November 2026  
**Document Owner:** Aradhya Tiwari (Data Engineering Lead)  
**Alignment:** `docs/architecture.md` v1.0, `docs/api-contract.md` v1, `docs/ai-guidance-design.md` v1.0

---

## 1. Design Principles

1. **PostgreSQL is the source of truth** for users, roles, career catalogue, assessment definitions, finalized scores/recommendations, availability slots, and bookings.
2. **MongoDB is append-only supplementary storage** for AI guidance conversations and optional assessment event snapshots. Mongo documents reference PostgreSQL UUIDs but never determine authorization, booking availability, or scoring.
3. **A MongoDB outage must not corrupt SQL state.** Guidance persistence failures surface as non-blocking `503` responses; all core flows (auth, assessment, recommendation, booking) remain fully operational.
4. **Prisma ORM** provides typed relational models, declarative migrations, and seed scripts. Raw SQL is documented separately for DE evaluation evidence.
5. **UTC timestamps everywhere.** The frontend handles timezone display; the database stores only UTC.

---

## 2. PostgreSQL Entities

### 2.1 User

Stores authentication credentials and role for all platform participants.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | Immutable identifier |
| `email` | `VARCHAR(255)` | `NOT NULL, UNIQUE` | Normalized lowercase, validated format |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id or bcrypt; never exposed in API responses |
| `display_name` | `VARCHAR(100)` | `NOT NULL` | 1–100 characters |
| `role` | `ENUM('STUDENT','COUNSELLOR','ADMIN')` | `NOT NULL, DEFAULT 'STUDENT'` | Registration always assigns `STUDENT` |
| `status` | `ENUM('ACTIVE','SUSPENDED')` | `NOT NULL, DEFAULT 'ACTIVE'` | Admin-controlled |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Indexes:** `UNIQUE(email)`

**Prisma model:**
```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  displayName  String   @map("display_name") @db.VarChar(100)
  role         Role     @default(STUDENT)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz

  studentProfile   StudentProfile?
  counsellorProfile CounsellorProfile?
  refreshSessions  RefreshSession[]

  @@map("users")
}

enum Role {
  STUDENT
  COUNSELLOR
  ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}
```

### 2.2 StudentProfile

Extended profile for students. Uses the User `id` as both PK and FK (1:1).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `UUID` | `PK, FK → users.id ON DELETE CASCADE` | 1:1 with User |
| `school_grade` | `VARCHAR(10)` | `NULL` | e.g. "9", "10", "11", "12" |
| `consent_accepted` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Guardian/school policy consent |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Prisma model:**
```prisma
model StudentProfile {
  userId          String   @id @map("user_id") @db.Uuid
  schoolGrade     String?  @map("school_grade") @db.VarChar(10)
  consentAccepted Boolean  @default(false) @map("consent_accepted")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  assessmentAttempts AssessmentAttempt[]
  bookings         Booking[]
  savedCareers     SavedCareer[]

  @@map("student_profiles")
}
```

### 2.3 CounsellorProfile

Extended profile for counsellors. Uses the User `id` as both PK and FK (1:1).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `UUID` | `PK, FK → users.id ON DELETE CASCADE` | 1:1 with User |
| `display_name` | `VARCHAR(100)` | `NOT NULL` | Public display name for counsellor directory |
| `bio` | `TEXT` | `NULL` | Brief professional description |
| `active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Whether accepting bookings |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Prisma model:**
```prisma
model CounsellorProfile {
  userId      String   @id @map("user_id") @db.Uuid
  displayName String   @map("display_name") @db.VarChar(100)
  bio         String?  @db.Text
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  availabilitySlots AvailabilitySlot[]
  bookings          Booking[]

  @@map("counsellor_profiles")
}
```

### 2.4 RefreshSession

Tracks JWT refresh token sessions for secure token rotation and revocation.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `user_id` | `UUID` | `FK → users.id ON DELETE CASCADE, NOT NULL` | |
| `hashed_token_id` | `VARCHAR(255)` | `NOT NULL` | Hash of the opaque refresh token |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Proposed 7-day expiry |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Set on logout or rotation |
| `rotated_from` | `UUID` | `FK → refresh_sessions.id, NULL` | Previous session in rotation chain |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Indexes:** `INDEX(user_id)`, `INDEX(hashed_token_id)`

**Prisma model:**
```prisma
model RefreshSession {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  hashedTokenId String    @map("hashed_token_id") @db.VarChar(255)
  expiresAt     DateTime  @map("expires_at") @db.Timestamptz
  revokedAt     DateTime? @map("revoked_at") @db.Timestamptz
  rotatedFrom   String?   @map("rotated_from") @db.Uuid
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  predecessor   RefreshSession? @relation("TokenRotation", fields: [rotatedFrom], references: [id])
  successors    RefreshSession[] @relation("TokenRotation")

  @@index([userId])
  @@index([hashedTokenId])
  @@map("refresh_sessions")
}
```

### 2.5 Assessment

Defines an interest assessment instrument. Assessments are versioned; published versions are immutable.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `title` | `VARCHAR(200)` | `NOT NULL` | |
| `description` | `TEXT` | `NULL` | |
| `version` | `INTEGER` | `NOT NULL, DEFAULT 1` | Monotonic; new version for edits |
| `status` | `ENUM('DRAFT','PUBLISHED','ARCHIVED')` | `NOT NULL, DEFAULT 'DRAFT'` | Published = immutable |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Indexes:** `INDEX(status)`

**Prisma model:**
```prisma
model Assessment {
  id          String           @id @default(uuid()) @db.Uuid
  title       String           @db.VarChar(200)
  description String?          @db.Text
  version     Int              @default(1)
  status      AssessmentStatus @default(DRAFT)
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  questions Question[]
  attempts  AssessmentAttempt[]

  @@index([status])
  @@map("assessments")
}

enum AssessmentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### 2.6 Question

Individual assessment question. Each question belongs to one assessment and maps to one interest dimension.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `assessment_id` | `UUID` | `FK → assessments.id ON DELETE CASCADE, NOT NULL` | |
| `dimension` | `ENUM(6 dimensions)` | `NOT NULL` | Interest dimension this question measures |
| `prompt` | `TEXT` | `NOT NULL` | Question text shown to student |
| `position` | `INTEGER` | `NOT NULL` | Display order within assessment |
| `weight` | `DECIMAL(5,4)` | `NOT NULL, DEFAULT 1.0, CHECK(weight > 0)` | Scoring weight (owned by Divy's algorithm) |
| `options` | `JSONB` | `NOT NULL` | Array of `{id, label, value}` objects |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Constraints:** `UNIQUE(assessment_id, position)` — no two questions share the same position in an assessment.

> [!NOTE]
> `options` is stored as JSONB. Each option has a unique `id` (UUID string), a `label` (display text), and a `value` (integer 0–4). The `value` field is never exposed to student API responses to preserve assessment integrity. The student submits only `optionId`.

**Prisma model:**
```prisma
model Question {
  id           String    @id @default(uuid()) @db.Uuid
  assessmentId String    @map("assessment_id") @db.Uuid
  dimension    Dimension
  prompt       String    @db.Text
  position     Int
  weight       Decimal   @default(1.0) @db.Decimal(5, 4)
  options      Json      @db.JsonB
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  answers    Answer[]

  @@unique([assessmentId, position])
  @@map("questions")
}

enum Dimension {
  ANALYTICAL
  CREATIVE
  SOCIAL
  PRACTICAL
  ORGANIZATIONAL
  INVESTIGATIVE
}
```

### 2.7 AssessmentAttempt

Records a student's attempt at completing an assessment. Stores finalized dimension scores after submission.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `student_id` | `UUID` | `FK → student_profiles.user_id ON DELETE CASCADE, NOT NULL` | Owning student |
| `assessment_id` | `UUID` | `FK → assessments.id ON DELETE RESTRICT, NOT NULL` | Assessment taken |
| `assessment_version` | `INTEGER` | `NOT NULL` | Snapshot of assessment version at attempt creation |
| `status` | `ENUM('IN_PROGRESS','COMPLETED','ABANDONED')` | `NOT NULL, DEFAULT 'IN_PROGRESS'` | |
| `scores_json` | `JSONB` | `NULL` | Normalized dimension scores after completion |
| `algorithm_version` | `VARCHAR(50)` | `NULL` | e.g. `cosine-v1`; set on completion |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Set on submission |

**Indexes:** `INDEX(student_id)`, `INDEX(assessment_id)`, `INDEX(status)`

> [!IMPORTANT]
> The scoring algorithm that computes `scores_json` is owned by Divy. This document defines the storage schema only. The mathematical computation (weighted cosine similarity, normalization, zero-vector handling) is specified in `docs/architecture.md` §7 and implemented by Divy in the backend service layer.

**Prisma model:**
```prisma
model AssessmentAttempt {
  id                String        @id @default(uuid()) @db.Uuid
  studentId         String        @map("student_id") @db.Uuid
  assessmentId      String        @map("assessment_id") @db.Uuid
  assessmentVersion Int           @map("assessment_version")
  status            AttemptStatus @default(IN_PROGRESS)
  scoresJson        Json?         @map("scores_json") @db.JsonB
  algorithmVersion  String?       @map("algorithm_version") @db.VarChar(50)
  startedAt         DateTime      @default(now()) @map("started_at") @db.Timestamptz
  completedAt       DateTime?     @map("completed_at") @db.Timestamptz

  student         StudentProfile  @relation(fields: [studentId], references: [userId], onDelete: Cascade)
  assessment      Assessment      @relation(fields: [assessmentId], references: [id], onDelete: Restrict)
  answers         Answer[]
  recommendations Recommendation[]

  @@index([studentId])
  @@index([assessmentId])
  @@index([status])
  @@map("assessment_attempts")
}

enum AttemptStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}
```

### 2.8 Answer

Records one student's response to one question within an attempt.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `attempt_id` | `UUID` | `FK → assessment_attempts.id ON DELETE CASCADE, NOT NULL` | |
| `question_id` | `UUID` | `FK → questions.id ON DELETE RESTRICT, NOT NULL` | |
| `selected_option_id` | `VARCHAR(36)` | `NOT NULL` | References `options[].id` in the Question JSONB |
| `score` | `INTEGER` | `NOT NULL, CHECK(score >= 0 AND score <= 4)` | Resolved server-side from option value; never client-supplied |
| `answered_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Constraints:** `UNIQUE(attempt_id, question_id)` — one answer per question per attempt.

> [!NOTE]
> The `score` column is populated server-side by looking up the `value` from the question's `options` JSONB when the student submits an `optionId`. Students cannot submit a numeric score directly.

**Prisma model:**
```prisma
model Answer {
  id               String   @id @default(uuid()) @db.Uuid
  attemptId        String   @map("attempt_id") @db.Uuid
  questionId       String   @map("question_id") @db.Uuid
  selectedOptionId String   @map("selected_option_id") @db.VarChar(36)
  score            Int
  answeredAt       DateTime @default(now()) @map("answered_at") @db.Timestamptz

  attempt  AssessmentAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question Question          @relation(fields: [questionId], references: [id], onDelete: Restrict)

  @@unique([attemptId, questionId])
  @@map("answers")
}
```

### 2.9 Career

A curated career entry in the catalogue. Careers are soft-deleted (unpublished), never hard-deleted, to preserve historical recommendation integrity.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `slug` | `VARCHAR(120)` | `NOT NULL, UNIQUE` | Lowercase kebab-case, URL-friendly |
| `title` | `VARCHAR(120)` | `NOT NULL` | 2–120 characters |
| `description` | `TEXT` | `NULL` | Human-reviewed summary |
| `published` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Only published careers appear in student views |
| `profile_version` | `INTEGER` | `NOT NULL, DEFAULT 1` | Monotonic version; incremented on dimension weight revision |
| `source_note` | `TEXT` | `NULL` | Source/verification provenance for catalogue entry |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Indexes:** `UNIQUE(slug)`, `INDEX(published)`

**Prisma model:**
```prisma
model Career {
  id             String   @id @default(uuid()) @db.Uuid
  slug           String   @unique @db.VarChar(120)
  title          String   @db.VarChar(120)
  description    String?  @db.Text
  published      Boolean  @default(false)
  profileVersion Int      @default(1) @map("profile_version")
  sourceNote     String?  @map("source_note") @db.Text
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  dimensions      CareerDimension[]
  careerSkills    CareerSkill[]
  pathways        EducationPathway[]
  recommendations Recommendation[]
  savedCareers    SavedCareer[]

  @@index([published])
  @@map("careers")
}
```

### 2.10 CareerDimension

Maps a career to its target dimension profile vector. Each career has one weight per dimension.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `career_id` | `UUID` | `FK → careers.id ON DELETE CASCADE, NOT NULL` | |
| `dimension` | `ENUM(6 dimensions)` | `NOT NULL` | |
| `target_weight` | `DECIMAL(5,4)` | `NOT NULL, CHECK(target_weight >= 0 AND target_weight <= 1)` | |

**Constraints:** `UNIQUE(career_id, dimension)` — one weight per dimension per career. At least one dimension must be nonzero per career (enforced at application layer).

**Prisma model:**
```prisma
model CareerDimension {
  id           String    @id @default(uuid()) @db.Uuid
  careerId     String    @map("career_id") @db.Uuid
  dimension    Dimension
  targetWeight Decimal   @map("target_weight") @db.Decimal(5, 4)

  career Career @relation(fields: [careerId], references: [id], onDelete: Cascade)

  @@unique([careerId, dimension])
  @@map("career_dimensions")
}
```

### 2.11 Skill and CareerSkill (Many-to-Many)

Skills are independent entities linked to careers through a join table.

**Skill:**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `name` | `VARCHAR(100)` | `NOT NULL, UNIQUE` | e.g. "Problem Solving", "Python" |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**CareerSkill (join table):**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `career_id` | `UUID` | `FK → careers.id ON DELETE CASCADE, NOT NULL` | |
| `skill_id` | `UUID` | `FK → skills.id ON DELETE CASCADE, NOT NULL` | |

**Constraints:** `PK(career_id, skill_id)`

**Prisma models:**
```prisma
model Skill {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique @db.VarChar(100)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  careerSkills CareerSkill[]

  @@map("skills")
}

model CareerSkill {
  careerId String @map("career_id") @db.Uuid
  skillId  String @map("skill_id") @db.Uuid

  career Career @relation(fields: [careerId], references: [id], onDelete: Cascade)
  skill  Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@id([careerId, skillId])
  @@map("career_skills")
}
```

### 2.12 EducationPathway

Verified educational stages (school → undergraduate → postgraduate) for a career.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `career_id` | `UUID` | `FK → careers.id ON DELETE CASCADE, NOT NULL` | |
| `stage` | `VARCHAR(50)` | `NOT NULL` | e.g. "Secondary", "Undergraduate", "Postgraduate" |
| `qualification` | `VARCHAR(200)` | `NOT NULL` | e.g. "B.Tech Computer Science" |
| `notes` | `TEXT` | `NULL` | Entrance exams, institutions, etc. |
| `verified_at` | `TIMESTAMPTZ` | `NULL` | Date of last human verification |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Prisma model:**
```prisma
model EducationPathway {
  id            String    @id @default(uuid()) @db.Uuid
  careerId      String    @map("career_id") @db.Uuid
  stage         String    @db.VarChar(50)
  qualification String    @db.VarChar(200)
  notes         String?   @db.Text
  verifiedAt    DateTime? @map("verified_at") @db.Timestamptz
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz

  career Career @relation(fields: [careerId], references: [id], onDelete: Cascade)

  @@map("education_pathways")
}
```

### 2.13 Recommendation

Persisted career recommendations linked to a specific assessment attempt. Generated atomically during submission.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `attempt_id` | `UUID` | `FK → assessment_attempts.id ON DELETE CASCADE, NOT NULL` | |
| `career_id` | `UUID` | `FK → careers.id ON DELETE RESTRICT, NOT NULL` | |
| `rank` | `INTEGER` | `NOT NULL, CHECK(rank >= 1)` | Deterministic: score desc, slug asc |
| `similarity_score` | `DECIMAL(7,6)` | `NOT NULL, CHECK(similarity_score >= 0 AND similarity_score <= 1)` | Cosine similarity [0, 1] |
| `explanation_json` | `JSONB` | `NULL` | `{reasons:[], cautions:[], careerProfileVersion:1, dimensionSnapshot:{}, algorithmWeights:{}}` |
| `algorithm_version` | `VARCHAR(50)` | `NOT NULL` | e.g. `cosine-v1` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Constraints:** `UNIQUE(attempt_id, career_id)` — no duplicate recommendations per attempt.

> [!IMPORTANT]
> The scoring logic that populates `similarity_score`, `rank`, and `explanation_json` is owned by Divy's recommendation service. This model defines the storage contract only.
>
> **Historical Reproducibility Strategy:** An `updated_at` timestamp alone on `careers` does not preserve previous target vector values. To guarantee historical recommendation reproducibility when career vectors or scoring parameters evolve:
> 1. **Student Vector:** Preserved immutably in `assessment_attempts.scores_json`.
> 2. **Career Vector:** Captured at calculation time via `careerProfileVersion` and snapshotted into `explanation_json.dimensionSnapshot` (e.g. `{"ANALYTICAL": 0.90, "CREATIVE": 0.30, ...}`).
> 3. **Global Algorithm Dimension Weights ($w_d$):** Reproducible via the immutable `algorithm_version` tag (e.g., `cosine-v1` strictly defines immutable unit weights $w_d = 1.0$ for all 6 dimensions; any weight tuning requires a new immutable identifier like `cosine-v2`) and/or snapshotted directly in `explanation_json.algorithmWeights`.
> An auditor can re-verify the exact cosine similarity calculation at any future date using only `assessment_attempts.scores_json`, `recommendations.explanation_json.dimensionSnapshot`, and the versioned/snapshotted algorithm weights, without introducing complex temporal tables or schema changes.

**Prisma model:**
```prisma
model Recommendation {
  id               String  @id @default(uuid()) @db.Uuid
  attemptId        String  @map("attempt_id") @db.Uuid
  careerId         String  @map("career_id") @db.Uuid
  rank             Int
  similarityScore  Decimal @map("similarity_score") @db.Decimal(7, 6)
  explanationJson  Json?   @map("explanation_json") @db.JsonB
  algorithmVersion String  @map("algorithm_version") @db.VarChar(50)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz

  attempt AssessmentAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  career  Career            @relation(fields: [careerId], references: [id], onDelete: Restrict)

  @@unique([attemptId, careerId])
  @@map("recommendations")
}
```

### 2.14 SavedCareer

Student's bookmarked/saved careers. Idempotent PUT/DELETE operations.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `student_id` | `UUID` | `FK → student_profiles.user_id ON DELETE CASCADE, NOT NULL` | |
| `career_id` | `UUID` | `FK → careers.id ON DELETE CASCADE, NOT NULL` | |
| `saved_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Constraints:** `PK(student_id, career_id)`

**Prisma model:**
```prisma
model SavedCareer {
  studentId String   @map("student_id") @db.Uuid
  careerId  String   @map("career_id") @db.Uuid
  savedAt   DateTime @default(now()) @map("saved_at") @db.Timestamptz

  student StudentProfile @relation(fields: [studentId], references: [userId], onDelete: Cascade)
  career  Career          @relation(fields: [careerId], references: [id], onDelete: Cascade)

  @@id([studentId, careerId])
  @@map("saved_careers")
}
```

### 2.15 AvailabilitySlot

Counsellor time slots available for booking. Each slot can be linked to at most one active booking.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `counsellor_id` | `UUID` | `FK → counsellor_profiles.user_id ON DELETE CASCADE, NOT NULL` | |
| `starts_at` | `TIMESTAMPTZ` | `NOT NULL` | Must be in the future at creation |
| `ends_at` | `TIMESTAMPTZ` | `NOT NULL, CHECK(ends_at > starts_at)` | |
| `status` | `ENUM('AVAILABLE','BOOKED','CANCELLED')` | `NOT NULL, DEFAULT 'AVAILABLE'` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Indexes:** `INDEX(counsellor_id, starts_at)`, `INDEX(status)`

> [!NOTE]
> Overlap prevention for a counsellor's slots (non-overlapping time ranges) can be enforced with a PostgreSQL exclusion constraint using `tstzrange` and `btree_gist`, or validated at the application layer. Exact strategy to be agreed before implementation.

**Prisma model:**
```prisma
model AvailabilitySlot {
  id           String     @id @default(uuid()) @db.Uuid
  counsellorId String     @map("counsellor_id") @db.Uuid
  startsAt     DateTime   @map("starts_at") @db.Timestamptz
  endsAt       DateTime   @map("ends_at") @db.Timestamptz
  status       SlotStatus @default(AVAILABLE)
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz

  counsellor CounsellorProfile @relation(fields: [counsellorId], references: [userId], onDelete: Cascade)
  bookings   Booking[]

  @@index([counsellorId, startsAt])
  @@index([status])
  @@map("availability_slots")
}

enum SlotStatus {
  AVAILABLE
  BOOKED
  CANCELLED
}
```

### 2.16 Booking

Appointment booking linking a student to a counsellor's slot.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `student_id` | `UUID` | `FK → student_profiles.user_id ON DELETE CASCADE, NOT NULL` | |
| `counsellor_id` | `UUID` | `FK → counsellor_profiles.user_id ON DELETE RESTRICT, NOT NULL` | Denormalized from slot for query convenience |
| `slot_id` | `UUID` | `FK → availability_slots.id ON DELETE RESTRICT, NOT NULL` | Enforced active/completed uniqueness via partial index |
| `status` | `ENUM('CONFIRMED','COMPLETED','CANCELLED')` | `NOT NULL, DEFAULT 'CONFIRMED'` | |
| `note` | `VARCHAR(500)` | `NULL` | Optional discussion note from student |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Constraints:**
- **Partial Unique Index:** `CREATE UNIQUE INDEX uq_bookings_active_or_completed_slot ON bookings (slot_id) WHERE status IN ('CONFIRMED', 'COMPLETED');`
  - Enforces that at most **one** active (`CONFIRMED`) or fulfilled (`COMPLETED`) booking can exist for a slot across its lifecycle.
  - **Prevents invalid rebooking after completion:** If the partial index covered only `CONFIRMED`, transitioning a booking to `COMPLETED` would drop it from the index, creating a vulnerability where a completed slot could be illegally rebooked. By including both `CONFIRMED` and `COMPLETED`, a completed session permanently retains its unique claim on that slot.
  - **Preserves valid cancellation & rebooking:** If a booking is cancelled (`CANCELLED`), its status transitions out of the indexed set (`CONFIRMED`, `COMPLETED`), immediately allowing the slot to return to `AVAILABLE` and accept a new confirmed booking.
  - All historical cancelled records are permanently preserved in the table for auditing, counsellor notes, and cancellation rate analytics without blocking valid rebooking.
- **Foreign Keys:** `student_id → student_profiles.user_id`, `counsellor_id → counsellor_profiles.user_id`, `slot_id → availability_slots.id`.

**Allowed status transitions:**
- `CONFIRMED → COMPLETED` (counsellor marks session done)
- `CONFIRMED → CANCELLED` (student cancels, or counsellor cancels; frees slot for rebooking)
- No transitions from `COMPLETED` or `CANCELLED` (terminal states)

**Prisma model:**
```prisma
model Booking {
  id           String        @id @default(uuid()) @db.Uuid
  studentId    String        @map("student_id") @db.Uuid
  counsellorId String        @map("counsellor_id") @db.Uuid
  slotId       String        @map("slot_id") @db.Uuid
  status       BookingStatus @default(CONFIRMED)
  note         String?       @db.VarChar(500)
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  student    StudentProfile    @relation(fields: [studentId], references: [userId], onDelete: Cascade)
  counsellor CounsellorProfile @relation(fields: [counsellorId], references: [userId], onDelete: Restrict)
  slot       AvailabilitySlot  @relation(fields: [slotId], references: [id], onDelete: Restrict)

  @@index([slotId])
  @@index([studentId])
  @@index([counsellorId])
  @@map("bookings")
}

// Note: Prisma DSL does not natively support partial WHERE predicates on @@unique.
// The partial unique index is defined in a custom Prisma migration:
// CREATE UNIQUE INDEX uq_bookings_active_or_completed_slot ON bookings (slot_id) WHERE status IN ('CONFIRMED', 'COMPLETED');

enum BookingStatus {
  CONFIRMED
  COMPLETED
  CANCELLED
}
```

### 2.17 EmailOutbox

Transactional outbox for reliable asynchronous notification delivery.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | `PK, DEFAULT gen_random_uuid()` | |
| `event_type` | `VARCHAR(50)` | `NOT NULL` | e.g. `BOOKING_CONFIRMED`, `BOOKING_CANCELLED` |
| `payload` | `JSONB` | `NOT NULL` | Serialized notification data |
| `status` | `ENUM('PENDING','SENT','FAILED')` | `NOT NULL, DEFAULT 'PENDING'` | |
| `attempts` | `INTEGER` | `NOT NULL, DEFAULT 0` | Retry counter |
| `next_attempt_at` | `TIMESTAMPTZ` | `NULL` | Next retry time with backoff |
| `idempotency_key` | `VARCHAR(36)` | `UNIQUE, NULL` | Prevents duplicate sends |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | |

**Prisma model:**
```prisma
model EmailOutbox {
  id             String       @id @default(uuid()) @db.Uuid
  eventType      String       @map("event_type") @db.VarChar(50)
  payload        Json         @db.JsonB
  status         OutboxStatus @default(PENDING)
  attempts       Int          @default(0)
  nextAttemptAt  DateTime?    @map("next_attempt_at") @db.Timestamptz
  idempotencyKey String?      @unique @map("idempotency_key") @db.VarChar(36)
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz

  @@index([status, nextAttemptAt])
  @@map("email_outbox")
}

enum OutboxStatus {
  PENDING
  SENT
  FAILED
}
```

---

## 3. Relationship Summary and Cardinalities

| Relationship | Cardinality | FK Location | ON DELETE |
|---|---|---|---|
| User → StudentProfile | 1 : 0..1 | `student_profiles.user_id` | CASCADE |
| User → CounsellorProfile | 1 : 0..1 | `counsellor_profiles.user_id` | CASCADE |
| User → RefreshSession | 1 : N | `refresh_sessions.user_id` | CASCADE |
| StudentProfile → AssessmentAttempt | 1 : N | `assessment_attempts.student_id` | CASCADE |
| Assessment → Question | 1 : N | `questions.assessment_id` | CASCADE |
| Assessment → AssessmentAttempt | 1 : N | `assessment_attempts.assessment_id` | RESTRICT |
| AssessmentAttempt → Answer | 1 : N | `answers.attempt_id` | CASCADE |
| Question → Answer | 1 : N | `answers.question_id` | RESTRICT |
| AssessmentAttempt → Recommendation | 1 : N | `recommendations.attempt_id` | CASCADE |
| Career → Recommendation | 1 : N | `recommendations.career_id` | RESTRICT |
| Career → CareerDimension | 1 : N (exactly 6) | `career_dimensions.career_id` | CASCADE |
| Career ↔ Skill (via CareerSkill) | M : N | `career_skills` join table | CASCADE |
| Career → EducationPathway | 1 : N | `education_pathways.career_id` | CASCADE |
| StudentProfile → SavedCareer | 1 : N | `saved_careers.student_id` | CASCADE |
| Career → SavedCareer | 1 : N | `saved_careers.career_id` | CASCADE |
| CounsellorProfile → AvailabilitySlot | 1 : N | `availability_slots.counsellor_id` | CASCADE |
| AvailabilitySlot → Booking | 1 : 0..1 active/completed (1 : N historical) | `bookings.slot_id` (partial UNIQUE on active or completed) | RESTRICT |
| StudentProfile → Booking | 1 : N | `bookings.student_id` | CASCADE |
| CounsellorProfile → Booking | 1 : N | `bookings.counsellor_id` | RESTRICT |

---

## 4. Migration Strategy

### 4.1 Prisma Migrations

1. **Initial migration:** `npx prisma migrate dev --name init` generates DDL for all tables, enums, indexes, and constraints from `schema.prisma`.
2. **Subsequent migrations:** each schema change creates a timestamped migration in `prisma/migrations/`. Migrations are committed to version control.
3. **Production deployment:** `npx prisma migrate deploy` applies pending migrations without interactive prompts.
4. **Migration naming convention:** `YYYYMMDDHHMMSS_descriptive_name` (auto-generated by Prisma).

### 4.2 Schema Evolution Rules

- Published assessments are immutable; add a new version row instead of altering questions.
- Career dimension profiles and algorithm weights are versioned via `profile_version` on `Career`, immutable `algorithm_version` tags defining global dimension weight vectors ($w_d$), and an immutable `dimensionSnapshot` embedded within each `Recommendation.explanation_json` record. When an administrator updates a career's dimension weights, `profile_version` increments and new assessments use the updated vector. Existing historical recommendations remain fully reproducible by comparing the attempt's `scores_json` with the snapshotted career vector and versioned algorithm weights.
- Adding nullable columns or new tables is non-breaking. Removing columns requires a two-phase migration (deprecate → remove).
- Enum additions (e.g., new `Dimension` value) require a migration and agreement across all three team members.

### 4.3 Seed Data

The seed script (`prisma/seed.ts`) populates development databases with:

| Entity | Seed Volume | Notes |
|---|---|---|
| Users | ~10 | 3 students, 2 counsellors, 1 admin; synthetic emails (`@example.test`) |
| Assessment | 1 | "Career Interest Explorer v1", 30 questions across 6 dimensions (5 per dimension) |
| Questions | 30 | Realistic prompts with 4–5 options each; option values 0–4 |
| Careers | 10–15 | e.g. Software Developer, Data Analyst, Graphic Designer, Civil Engineer, Teacher, etc. |
| CareerDimensions | 6 per career | Nonzero target weights |
| Skills | 15–20 | e.g. "Problem Solving", "Communication", "Python", "Statistics" |
| CareerSkills | 3–5 per career | |
| EducationPathways | 2–3 per career | Stages: Secondary → Undergraduate → Postgraduate |
| AvailabilitySlots | 5–10 | Future UTC slots for seeded counsellors |

> [!CAUTION]
> Seed passwords use bcrypt/Argon2id hashing with a known synthetic password (e.g., `SyntheticDemo123!`). Never use real student data. Seed credentials must be marked as synthetic in documentation.

---

## 5. Transaction Integrity

### 5.1 Assessment Submission Transaction

When a student submits a completed assessment, the following operations execute within a single PostgreSQL transaction:

```text
BEGIN;
  -- 1. Validate all required questions answered
  -- 2. Compute dimension scores (Divy's algorithm)
  -- 3. UPDATE assessment_attempts SET status='COMPLETED', scores_json=..., completed_at=NOW()
  -- 4. INSERT INTO recommendations (attempt_id, career_id, rank, similarity_score, ...)
  --    for each published career, ranked by similarity
  -- 5. (Optional) INSERT INTO email_outbox for notification
COMMIT;
```

If any step fails, the entire transaction rolls back. A concurrent double-submit on the same attempt is prevented by checking `status = 'IN_PROGRESS'` with a row-level lock (`SELECT ... FOR UPDATE`).

### 5.2 Booking Transaction and Concurrency Protection

Booking creation must be strictly atomic within a single PostgreSQL transaction to prevent race conditions and double-booking. The architecture combines **application concurrency controls** with an **unbreakable database-level safeguard**:

```text
BEGIN;
  -- Concurrency strategy A: Atomic conditional state update
  -- UPDATE availability_slots SET status = 'BOOKED' WHERE id = :slotId AND status = 'AVAILABLE' RETURNING id, counsellor_id;
  -- If rows affected == 0 -> ROLLBACK and return 409 SLOT_UNAVAILABLE

  -- Concurrency strategy B (Alternative): Explicit row-level lock
  -- SELECT id, counsellor_id, status FROM availability_slots WHERE id = :slotId AND status = 'AVAILABLE' FOR UPDATE;
  -- If no row returned -> ROLLBACK and return 409 SLOT_UNAVAILABLE
  -- UPDATE availability_slots SET status = 'BOOKED' WHERE id = :slotId;

  -- Insert booking record
  INSERT INTO bookings (id, student_id, counsellor_id, slot_id, status, note)
  VALUES (gen_random_uuid(), :studentId, :counsellorId, :slotId, 'CONFIRMED', :note);

  -- Transactional outbox for reliable asynchronous notification dispatch
  INSERT INTO email_outbox (id, event_type, payload, idempotency_key)
  VALUES (gen_random_uuid(), 'BOOKING_CONFIRMED', :payload, :idempotencyKey);
COMMIT;
```

**Why this prevents races:**
1. **Atomic Conditional State Update:** The `UPDATE availability_slots SET status = 'BOOKED' WHERE id = :slotId AND status = 'AVAILABLE'` statement acquires an exclusive row lock during statement execution in PostgreSQL. If two concurrent transactions execute this simultaneously, the first acquires the row and flips the status to `'BOOKED'`. The second transaction waits for the lock, then evaluates the `WHERE status = 'AVAILABLE'` predicate against the newly committed row; the predicate evaluates to false, updating 0 rows. The application detects `count === 0` and immediately responds with `409 Conflict (SLOT_UNAVAILABLE)` without proceeding.
2. **Database Partial Unique Index Safeguard:** Even if application concurrency logic or transaction isolation levels were misconfigured, the partial unique index:
   ```sql
   CREATE UNIQUE INDEX uq_bookings_active_or_completed_slot ON bookings (slot_id) WHERE status IN ('CONFIRMED', 'COMPLETED');
   ```
   guarantees that PostgreSQL will reject any simultaneous `INSERT` into `bookings` for the same `slot_id` with a unique constraint violation (`23505`), converted by the service layer into a clean `409 Conflict`. Crucially, because the condition includes both `'CONFIRMED'` and `'COMPLETED'`, this protection persists after the appointment has taken place, preventing invalid rebooking of completed sessions.
3. **Idempotency Protection:** Clients submitting repeated booking requests with the same `Idempotency-Key` header receive the existing booking confirmation rather than creating duplicates.

### 5.3 Booking Cancellation and Rebooking Consistency

Booking cancellation runs inside a PostgreSQL transaction to atomically transition both the booking and slot records:

```text
BEGIN;
  -- 1. Lock and verify the active confirmed booking owned by the student
  SELECT id, slot_id, status FROM bookings
  WHERE id = :bookingId AND student_id = :studentId AND status = 'CONFIRMED'
  FOR UPDATE;
  -- If no row found -> ROLLBACK and return 404 (or 409 if already completed/cancelled)

  -- 2. Transition booking status to CANCELLED (preserves record in history)
  UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = :bookingId;

  -- 3. Transition slot status back to AVAILABLE to allow rebooking
  UPDATE availability_slots SET status = 'AVAILABLE' WHERE id = :slotId;

  -- 4. Queue cancellation notification in transactional outbox
  INSERT INTO email_outbox (id, event_type, payload, idempotency_key)
  VALUES (gen_random_uuid(), 'BOOKING_CANCELLED', :payload, :idempotencyKey);
COMMIT;
```

**Preserving History while Allowing Rebooking (and Locking Completed Sessions):**
- In a naive design with `UNIQUE(slot_id)`, cancelling a booking would prevent that slot from ever being rebooked because the cancelled record still occupies the unique slot ID.
- Under our **partial unique index** (`WHERE status IN ('CONFIRMED', 'COMPLETED')`), transitioning the existing booking to `status = 'CANCELLED'` automatically removes it from the index constraint.
- The slot's status returns to `AVAILABLE`, enabling another student (or the same student) to subsequently book that exact slot.
- When rebooked, a new row is inserted into `bookings` with `status = 'CONFIRMED'`. Both the old cancelled booking and the new confirmed booking remain in the database, ensuring full auditability, complete cancellation analytics, and no lost counsellor records.
- **Completed Sessions Permanently Locked:** Once a session occurs and transitions to `status = 'COMPLETED'`, it remains inside the `WHERE status IN ('CONFIRMED', 'COMPLETED')` index predicate forever. Thus, completed slots can never be rebooked, preserving historical and transactional integrity.

### 5.4 Cross-Database (SQL + Mongo) Integrity

SQL and MongoDB do not share distributed transactions. The rule is:

1. **Persist to PostgreSQL first** (the authoritative store).
2. **Write to MongoDB best-effort** with retry.
3. If Mongo write fails, the SQL result stands. Surface a non-blocking warning or log the failure; do not roll back SQL.

This applies to:
- Assessment event snapshots (optional Mongo append after SQL attempt creation).
- Guidance session creation (Mongo document created after SQL validation of attempt/career ownership).

---

## 6. MongoDB Collections

### 6.1 `guidance_sessions`

Stores AI guidance conversation history. Referenced in `docs/ai-guidance-design.md`.

**Sample document:**
```json
{
  "_id": ObjectId("6731ec8e1c4a520012ab1234"),
  "sessionId": "6731ec8e1c4a520012ab1234",
  "studentId": "11111111-1111-4111-8111-111111111111",
  "attemptId": "22222222-2222-4222-8222-222222222222",
  "careerIds": [
    "33333333-3333-4333-8333-333333333333"
  ],
  "messages": [
    {
      "role": "user",
      "text": "Why is Software Developer recommended for me?",
      "groundingCareerIds": [],
      "createdAt": "2026-11-11T10:05:00.000Z"
    },
    {
      "role": "assistant",
      "text": "Your assessment results show a strong Analytical alignment (0.90) and Investigative alignment (0.80). Software Development emphasizes these dimensions heavily...",
      "groundingCareerIds": ["33333333-3333-4333-8333-333333333333"],
      "createdAt": "2026-11-11T10:05:30.000Z"
    }
  ],
  "model": "gpt-4o-mini",
  "consentVersion": "v1",
  "createdAt": "2026-11-11T10:04:50.000Z",
  "updatedAt": "2026-11-11T10:05:30.000Z"
}
```

**Mongoose schema:**
```javascript
const GuidanceMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, required: true, maxlength: 2000 },
  groundingCareerIds: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const GuidanceSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  studentId: { type: String, required: true, index: true },
  attemptId: { type: String, required: true },
  careerIds: [{ type: String, required: true }],
  messages: {
    type: [GuidanceMessageSchema],
    validate: [arr => arr.length <= 40, 'Session limited to 40 messages (20 exchanges)']
  },
  model: { type: String, required: true, default: 'gpt-4o-mini' },
  consentVersion: { type: String, required: true, default: 'v1' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

GuidanceSessionSchema.index({ studentId: 1, updatedAt: -1 });
```

**Cross-database references:**
- `studentId` → PostgreSQL `users.id` (validated at API layer before Mongo write)
- `attemptId` → PostgreSQL `assessment_attempts.id` (validated at API layer)
- `careerIds[*]` → PostgreSQL `careers.id` (validated at API layer)

These are string references, not Mongoose `ObjectId` refs. Referential integrity is enforced at the application/service layer, not by MongoDB foreign keys.

### 6.2 `assessment_events`

Optional append-only event log for assessment progress diagnostics. Not authoritative for scoring.

**Sample document:**
```json
{
  "_id": ObjectId("6731ed0a1c4a520012ab5678"),
  "attemptId": "22222222-2222-4222-8222-222222222222",
  "studentId": "11111111-1111-4111-8111-111111111111",
  "assessmentVersion": 1,
  "eventType": "ANSWER_SAVED",
  "occurredAt": "2026-11-11T09:55:00.000Z",
  "metadata": {
    "questionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "optionId": "opt-3"
  }
}
```

**Mongoose schema:**
```javascript
const AssessmentEventSchema = new mongoose.Schema({
  attemptId: { type: String, required: true },
  studentId: { type: String, required: true },
  assessmentVersion: { type: Number, required: true },
  eventType: {
    type: String,
    required: true,
    enum: ['ATTEMPT_STARTED', 'ANSWER_SAVED', 'ANSWER_CHANGED', 'ATTEMPT_SUBMITTED', 'ATTEMPT_ABANDONED']
  },
  occurredAt: { type: Date, required: true, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: false });

AssessmentEventSchema.index({ attemptId: 1, occurredAt: 1 });
AssessmentEventSchema.index({ studentId: 1, occurredAt: -1 });
```

### 6.3 MongoDB CRUD Operations

**Create — insert a new guidance session:**
```javascript
await GuidanceSession.create({
  sessionId: new mongoose.Types.ObjectId().toString(),
  studentId: '11111111-1111-4111-8111-111111111111',
  attemptId: '22222222-2222-4222-8222-222222222222',
  careerIds: ['33333333-3333-4333-8333-333333333333'],
  messages: [],
  model: 'gpt-4o-mini',
  consentVersion: 'v1'
});
```

**Read — fetch student's sessions (sorted by most recent):**
```javascript
const sessions = await GuidanceSession.find({ studentId: userId })
  .sort({ updatedAt: -1 })
  .limit(20)
  .select('sessionId attemptId careerIds createdAt updatedAt');
```

**Read — fetch a single session by ID (ownership check):**
```javascript
const session = await GuidanceSession.findOne({
  sessionId: sessionId,
  studentId: userId     // ownership enforcement
});
if (!session) throw new NotFoundError();
```

**Update — append a message to a session:**
```javascript
const result = await GuidanceSession.findOneAndUpdate(
  { sessionId: sessionId, studentId: userId },
  {
    $push: { messages: { role: 'assistant', text: aiResponse, groundingCareerIds: ['...'] } },
    $set: { updatedAt: new Date() }
  },
  { new: true }
);
```

**Delete — remove a student's guidance session:**
```javascript
const result = await GuidanceSession.deleteOne({
  sessionId: sessionId,
  studentId: userId    // ownership enforcement
});
if (result.deletedCount === 0) throw new NotFoundError();
```

### 6.4 MongoDB Aggregation Examples

**Aggregate: count sessions and messages per student (admin diagnostics):**
```javascript
const stats = await GuidanceSession.aggregate([
  { $group: {
    _id: '$studentId',
    sessionCount: { $sum: 1 },
    totalMessages: { $sum: { $size: '$messages' } },
    lastActivity: { $max: '$updatedAt' }
  }},
  { $sort: { lastActivity: -1 } },
  { $limit: 50 }
]);
```

**Aggregate: most frequently discussed careers across all sessions:**
```javascript
const topCareers = await GuidanceSession.aggregate([
  { $unwind: '$careerIds' },
  { $group: {
    _id: '$careerIds',
    discussionCount: { $sum: 1 }
  }},
  { $sort: { discussionCount: -1 } },
  { $limit: 10 }
]);
```

**Aggregate: average messages per session by model:**
```javascript
const avgByModel = await GuidanceSession.aggregate([
  { $project: {
    model: 1,
    messageCount: { $size: '$messages' }
  }},
  { $group: {
    _id: '$model',
    avgMessages: { $avg: '$messageCount' },
    totalSessions: { $sum: 1 }
  }}
]);
```

### 6.5 Proposed Retention and Deletion Policy (Pending Approval)

> [!NOTE]
> The retention periods and automated deletion mechanisms outlined below are **proposed recommendations** pending formal data governance review and approval by school administrators and academic mentors. They are documented as design specifications and are not claimed as finalized or fully implemented operational policies.

| Policy Parameter | Proposed Rule | Status & Governance Context |
|---|---|---|
| Session message cap | 40 messages (20 user + 20 assistant exchanges) per session | Proposed to bound LLM context size and storage growth |
| Guidance session retention | Proposed 180 days from `updatedAt` | Pending mentor approval; sessions older than 180 days proposed for automated deletion |
| Student-initiated deletion | `DELETE /guidance/sessions/:id` hard-deletes document | Designed endpoint to support student right to erasure / data minimization |
| PII minimization | Zero student names, emails, DOB, or phone numbers in Mongo | Active architectural constraint enforced at backend controller layer |
| Retention enforcement | Scheduled background job or MongoDB TTL index on `updatedAt` | Proposed implementation strategy; to be agreed with backend lead before deployment |
| Assessment events retention | Proposed 90 days from `occurredAt` | Diagnostic telemetry only; proposed automated purge after 90 days |

---

## 7. SQL Query Evidence for Data Engineering Evaluation

This section documents the types of SQL operations required for the DE rubric. These are representative queries, not final implementations.

### 7.1 CRUD Operations

**CREATE — Register a new user:**
```sql
INSERT INTO users (id, email, password_hash, display_name, role, status)
VALUES (gen_random_uuid(), 'student@example.test', '$argon2id$...', 'Test Student', 'STUDENT', 'ACTIVE')
RETURNING id, email, role, created_at;
```

**READ — Fetch a user by email (login):**
```sql
SELECT id, email, password_hash, role, status
FROM users
WHERE email = 'student@example.test' AND status = 'ACTIVE';
```

**UPDATE — Mark an assessment attempt completed:**
```sql
UPDATE assessment_attempts
SET status = 'COMPLETED',
    scores_json = '{"ANALYTICAL":0.9,"CREATIVE":0.3,...}'::jsonb,
    algorithm_version = 'cosine-v1',
    completed_at = NOW()
WHERE id = :attemptId AND student_id = :studentId AND status = 'IN_PROGRESS';
```

**DELETE — Remove a saved career (idempotent):**
```sql
DELETE FROM saved_careers
WHERE student_id = :studentId AND career_id = :careerId;
```

### 7.2 JOIN Queries

**JOIN — Student's recommendations with career details:**
```sql
SELECT r.rank, r.similarity_score, r.algorithm_version, r.explanation_json,
       c.slug, c.title, c.description
FROM recommendations r
JOIN careers c ON c.id = r.career_id
WHERE r.attempt_id = :attemptId
ORDER BY r.rank ASC;
```

**Multi-table JOIN — Student's booking with counsellor and slot details:**
```sql
SELECT b.id AS booking_id, b.status, b.note, b.created_at,
       s.starts_at, s.ends_at,
       cp.display_name AS counsellor_name, cp.bio
FROM bookings b
JOIN availability_slots s ON s.id = b.slot_id
JOIN counsellor_profiles cp ON cp.user_id = b.counsellor_id
WHERE b.student_id = :studentId
ORDER BY s.starts_at DESC;
```

**JOIN — Career detail with skills:**
```sql
SELECT c.id, c.slug, c.title, c.description,
       sk.name AS skill_name
FROM careers c
JOIN career_skills cs ON cs.career_id = c.id
JOIN skills sk ON sk.id = cs.skill_id
WHERE c.slug = :slug AND c.published = TRUE;
```

**JOIN — Career detail with dimension profile:**
```sql
SELECT c.id, c.title,
       cd.dimension, cd.target_weight
FROM careers c
JOIN career_dimensions cd ON cd.career_id = c.id
WHERE c.id = :careerId
ORDER BY cd.dimension;
```

### 7.3 Aggregation Queries

**COUNT — Total completed assessments in a date range:**
```sql
SELECT COUNT(*) AS total_completed
FROM assessment_attempts
WHERE status = 'COMPLETED'
  AND completed_at BETWEEN :from AND :to;
```

**GROUP BY — Top interest dimensions across all completed attempts (k-anonymity suppressed):**
```sql
SELECT dimension, ROUND(AVG(avg_score), 4) AS mean_score, COUNT(*) AS student_count
FROM (
  SELECT aa.student_id,
         key AS dimension,
         (value::text)::numeric AS avg_score
  FROM assessment_attempts aa,
       jsonb_each(aa.scores_json) AS kv(key, value)
  WHERE aa.status = 'COMPLETED'
    AND aa.completed_at BETWEEN :from AND :to
) sub
GROUP BY dimension
HAVING COUNT(*) >= 5  -- k-anonymity suppression
ORDER BY mean_score DESC;
```

**Booking utilization and counsellor metrics (with precise denominators & cancellation handling):**
```sql
-- Calculates slot capacity utilization, session fulfillment rate, and cancellation attrition
-- Denominator for utilization: Valid published slots offered (excluding slots retracted/cancelled by counsellor)
-- Numerator for utilization: Distinct slots with active or completed student bookings (rebooked slots counted once)
-- Denominator for completion: Scheduled sessions whose scheduled time has elapsed (excluding student-cancelled bookings)
SELECT cp.display_name,
       -- Total active capacity offered by counsellor
       COUNT(DISTINCT CASE WHEN s.status != 'CANCELLED' THEN s.id END) AS total_valid_slots,
       -- Distinct slots utilized by confirmed or completed bookings
       COUNT(DISTINCT CASE WHEN b.status IN ('CONFIRMED','COMPLETED') THEN s.id END) AS utilized_slots,
       -- Capacity utilization rate
       ROUND(
         COUNT(DISTINCT CASE WHEN b.status IN ('CONFIRMED','COMPLETED') THEN s.id END)::numeric /
         NULLIF(COUNT(DISTINCT CASE WHEN s.status != 'CANCELLED' THEN s.id END), 0),
         2
       ) AS slot_utilization_rate,
       -- Total sessions successfully completed within the eligible elapsed window
       COUNT(DISTINCT CASE WHEN b.status = 'COMPLETED' AND s.ends_at <= LEAST(:to, NOW()) THEN b.id END) AS completed_sessions,
       -- Counsellor fulfillment rate (completed / non-cancelled sessions that reached scheduled time within query window)
       ROUND(
         COUNT(DISTINCT CASE WHEN b.status = 'COMPLETED' AND s.ends_at <= LEAST(:to, NOW()) THEN b.id END)::numeric /
         NULLIF(COUNT(DISTINCT CASE WHEN b.status IN ('CONFIRMED','COMPLETED') AND s.ends_at <= LEAST(:to, NOW()) THEN b.id END), 0),
         2
       ) AS session_completion_rate,
       -- Cancellation rate: proportion of total requested bookings that were cancelled
       ROUND(
         COUNT(DISTINCT CASE WHEN b.status = 'CANCELLED' THEN b.id END)::numeric /
         NULLIF(COUNT(DISTINCT b.id), 0),
         2
       ) AS cancellation_rate
FROM counsellor_profiles cp
JOIN availability_slots s ON s.counsellor_id = cp.user_id
LEFT JOIN bookings b ON b.slot_id = s.id
WHERE s.starts_at BETWEEN :from AND :to
GROUP BY cp.user_id, cp.display_name
HAVING COUNT(DISTINCT s.id) >= 1
ORDER BY slot_utilization_rate DESC;
```

**Career save frequency:**
```sql
SELECT c.title, COUNT(sc.student_id) AS save_count
FROM saved_careers sc
JOIN careers c ON c.id = sc.career_id
GROUP BY c.id, c.title
HAVING COUNT(sc.student_id) >= 5  -- k-anonymity
ORDER BY save_count DESC
LIMIT 20;
```

### 7.4 Subquery Examples

**Subquery — Students who completed an assessment but have no bookings:**
```sql
SELECT u.id, u.email, u.display_name
FROM users u
JOIN student_profiles sp ON sp.user_id = u.id
WHERE EXISTS (
  SELECT 1 FROM assessment_attempts aa
  WHERE aa.student_id = sp.user_id AND aa.status = 'COMPLETED'
)
AND NOT EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.student_id = sp.user_id AND b.status IN ('CONFIRMED','COMPLETED')
);
```

**Subquery — Careers recommended most frequently in the top 3 ranks:**
```sql
SELECT c.title, sub.recommend_count
FROM (
  SELECT career_id, COUNT(*) AS recommend_count
  FROM recommendations
  WHERE rank <= 3
  GROUP BY career_id
) sub
JOIN careers c ON c.id = sub.career_id
ORDER BY sub.recommend_count DESC
LIMIT 10;
```

**Correlated subquery — Each student's highest similarity score:**
```sql
SELECT u.display_name, r.similarity_score, c.title AS top_career
FROM recommendations r
JOIN assessment_attempts aa ON aa.id = r.attempt_id
JOIN users u ON u.id = aa.student_id
JOIN careers c ON c.id = r.career_id
WHERE r.similarity_score = (
  SELECT MAX(r2.similarity_score)
  FROM recommendations r2
  WHERE r2.attempt_id = r.attempt_id
)
ORDER BY r.similarity_score DESC;
```

---

## 8. Prisma ORM Evidence

### 8.1 Prisma Relationship Queries

**Find student with profile, latest attempt, and saved careers:**
```typescript
const student = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    studentProfile: {
      include: {
        assessmentAttempts: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { recommendations: { orderBy: { rank: 'asc' }, take: 5 } }
        },
        savedCareers: {
          include: { career: true },
          orderBy: { savedAt: 'desc' },
          take: 10
        }
      }
    }
  }
});
```

**Career with full details (dimensions, skills, pathways):**
```typescript
const career = await prisma.career.findUnique({
  where: { slug: 'software-developer' },
  include: {
    dimensions: true,
    careerSkills: { include: { skill: true } },
    pathways: { orderBy: { stage: 'asc' } }
  }
});
```

### 8.2 Prisma CRUD Examples

**Create a career with dimensions, skills, and pathways (nested write):**
```typescript
const career = await prisma.career.create({
  data: {
    slug: 'data-analyst',
    title: 'Data Analyst',
    description: 'Analyses data to extract actionable business insights.',
    published: true,
    sourceNote: 'Curated from government occupational databases.',
    dimensions: {
      create: [
        { dimension: 'ANALYTICAL', targetWeight: 0.9 },
        { dimension: 'INVESTIGATIVE', targetWeight: 0.7 },
        { dimension: 'ORGANIZATIONAL', targetWeight: 0.6 },
        { dimension: 'PRACTICAL', targetWeight: 0.4 },
        { dimension: 'CREATIVE', targetWeight: 0.3 },
        { dimension: 'SOCIAL', targetWeight: 0.2 }
      ]
    },
    careerSkills: {
      create: [
        { skill: { connect: { name: 'Statistics' } } },
        { skill: { connect: { name: 'Python' } } }
      ]
    },
    pathways: {
      create: [
        { stage: 'Undergraduate', qualification: 'B.Sc Statistics / B.Tech CSE', notes: 'CUET-UG, JEE Main' },
        { stage: 'Postgraduate', qualification: 'M.Sc Data Science / MBA Analytics', notes: 'CAT, GATE' }
      ]
    }
  },
  include: { dimensions: true, careerSkills: { include: { skill: true } }, pathways: true }
});
```

**Paginated career listing with filters (Prisma):**
```typescript
const [careers, total] = await prisma.$transaction([
  prisma.career.findMany({
    where: {
      published: true,
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(skillId ? { careerSkills: { some: { skillId } } } : {})
    },
    orderBy: { [sort]: order },
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, slug: true, title: true, description: true }
  }),
  prisma.career.count({
    where: {
      published: true,
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(skillId ? { careerSkills: { some: { skillId } } } : {})
    }
  })
]);
```

**Transactional booking creation with race prevention (Prisma interactive transaction):**
```typescript
// Prevents race conditions using an atomic conditional update inside an interactive transaction.
// A naive findFirst() followed by update() creates a race condition where two requests can both
// read status='AVAILABLE' before either writes. The atomic updateMany() below executes
// `UPDATE ... WHERE id = :slotId AND status = 'AVAILABLE'` in one step.
const booking = await prisma.$transaction(async (tx) => {
  // Step 1: Atomic conditional update. In PostgreSQL, this locks the matching row.
  // If another concurrent transaction already flipped status to 'BOOKED', count will be 0.
  const updateResult = await tx.availabilitySlot.updateMany({
    where: {
      id: slotId,
      status: 'AVAILABLE'
    },
    data: {
      status: 'BOOKED'
    }
  });

  if (updateResult.count === 0) {
    // Slot is already booked, cancelled by counsellor, or non-existent
    throw new ConflictError('SLOT_UNAVAILABLE');
  }

  // Step 2: Fetch counsellorId from slot after ownership is atomically secured
  const slot = await tx.availabilitySlot.findUniqueOrThrow({
    where: { id: slotId },
    select: { counsellorId: true, startsAt: true }
  });

  // Step 3: Insert booking record.
  // Enforced by PostgreSQL partial unique index:
  // CREATE UNIQUE INDEX uq_bookings_active_or_completed_slot ON bookings (slot_id) WHERE status IN ('CONFIRMED', 'COMPLETED');
  // Even if application checks were bypassed, the DB rejects concurrent active bookings and protects completed slots.
  const newBooking = await tx.booking.create({
    data: {
      studentId,
      counsellorId: slot.counsellorId,
      slotId,
      note,
      status: 'CONFIRMED'
    }
  });

  // Step 4: Transactional outbox for reliable asynchronous notification dispatch
  await tx.emailOutbox.create({
    data: {
      eventType: 'BOOKING_CONFIRMED',
      payload: {
        bookingId: newBooking.id,
        slotId,
        studentId,
        counsellorId: slot.counsellorId,
        startsAt: slot.startsAt.toISOString()
      },
      idempotencyKey: crypto.randomUUID()
    }
  });

  return newBooking;
});
```

*(Alternative PostgreSQL Locking via Raw Query in Prisma):*
```typescript
// If explicit SELECT FOR UPDATE is preferred over atomic conditional update:
const booking = await prisma.$transaction(async (tx) => {
  const [lockedSlot] = await tx.$queryRaw<Array<{ id: string; counsellor_id: string }>>`
    SELECT id, counsellor_id FROM availability_slots
    WHERE id = ${slotId}::uuid AND status = 'AVAILABLE'
    FOR UPDATE
  `;
  if (!lockedSlot) throw new ConflictError('SLOT_UNAVAILABLE');

  await tx.availabilitySlot.update({
    where: { id: slotId },
    data: { status: 'BOOKED' }
  });

  return await tx.booking.create({
    data: { studentId, counsellorId: lockedSlot.counsellor_id, slotId, note, status: 'CONFIRMED' }
  });
});
```

---

## 9. Open Integration Decisions

> [!WARNING]
> The following items require team agreement before implementation begins.

| # | Decision | Status | Affected Parties | Notes |
|---|---|---|---|---|
| 1 | **Multi-school tenancy (`schoolId`)** | Pending Approval | All | Architecture §4 notes this is pending. If required, add `school_id` FK to `users`, `student_profiles`, all queries and RBAC. |
| 2 | **API contract: `GET /counsellors/me/slots`** | **Resolved** | Aradhya, Divy | Endpoint formally added to `docs/api-contract.md` §7 (returns own slots across all statuses). |
| 3 | **Slot overlap prevention strategy** | Pending Evaluation | Aradhya, Divy | Use PostgreSQL exclusion constraint (`EXCLUDE USING gist`) vs. application-layer validation. Exclusion constraints require `btree_gist` extension. |
| 4 | **`dimensionProfile` field in Career POST body** | **Resolved** | Aradhya, Divy | API contract §6 accepts `dimensionProfile` as a key-value object; backend service maps to `career_dimensions` rows via Prisma nested write. |
| 5 | **Assessment events collection** | Pending Confirmation | Aradhya, Dhavika | Architecture §6 describes `assessment_events` in Mongo. Confirmed as backend-only diagnostic telemetry; frontend emits standard REST actions. |
| 6 | **Guidance session `sessionId` format** | Pending Confirmation | Aradhya, Dhavika | API contract and AI design use Mongo ObjectId strings for `sessionId`. Confirm this is acceptable or if UUID strings are preferred for consistency. |
| 7 | **Student age/consent and data retention** | Pending Approval | All | Architecture §13 flags this as unresolved. Affects `consent_accepted` field semantics, retention policies, and deletion workflows. Requires mentor approval. |
| 8 | **Booking cancellation cutoff** | Pending Approval | Aradhya, Divy | Architecture §10 proposes no cutoff for MVP demo. Confirm or define a cutoff policy. |

---

## 10. DE Rubric Traceability

| Rubric Area | Evidence in This Document | Section |
|---|---|---|
| **Relational data model** | 17 PostgreSQL entities with PKs, FKs, constraints, cardinalities | §2, §3 |
| **ER diagram** | See companion `docs/er-diagram.md` | — |
| **DDL / SQL** | Representative CREATE, INSERT, SELECT, UPDATE, DELETE statements | §7.1 |
| **JOIN queries** | 2-table and 3-table JOINs across recommendations, careers, bookings, skills | §7.2 |
| **Aggregation** | COUNT, AVG, GROUP BY, HAVING with k-anonymity suppression | §7.3 |
| **Subqueries** | EXISTS, NOT EXISTS, correlated subqueries, derived tables | §7.4 |
| **ORM (Prisma)** | Complete models with relations, nested writes, interactive transactions | §2 (all models), §8 |
| **Prisma migrations** | Migration strategy, naming convention, evolution rules | §4 |
| **Seed data** | Seeding plan with volumes and synthetic data policy | §4.3 |
| **MongoDB collections** | 2 collections with Mongoose schemas, sample documents | §6.1, §6.2 |
| **MongoDB CRUD** | Create, Read (find, findOne), Update ($push, $set), Delete | §6.3 |
| **MongoDB aggregation** | $group, $unwind, $sort, $limit, $avg, $sum, $size | §6.4 |
| **Transaction integrity** | Assessment submission, booking creation, booking cancellation | §5 |
| **Cross-DB references** | String UUID references from Mongo to Postgres, validated at API layer | §6.1 |

