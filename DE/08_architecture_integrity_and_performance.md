# 08. Data Integrity, Indexing & Performance Engineering

**Project:** CareerCompass — Secondary School Guidance Platform
**Component:** Data Engineering Deliverable #8
**Author:** Aradhya Tiwari (Data Engineering Lead)

---

## 1. Data Integrity & Constraints Framework

To protect the platform against corruption, invalid inputs, and concurrency anomalies, CareerCompass enforces a multi-layered integrity architecture:

```
[Client UI Validation] ──> [Zod Schema Validation] ──> [Database Engine Constraints]
   (React Forms)               (API Boundary)             (PostgreSQL DDL Rules)
```

### Relational Constraints in PostgreSQL:
1. **Primary & Foreign Key Referential Integrity:**
   - All relations declare synthetic UUID primary keys (`DEFAULT gen_random_uuid()`).
   - Cascade Deletions (`ON DELETE CASCADE`): Applied to dependent child records (`student_profiles`, `counsellor_profiles`, `answers`, `recommendations`, `career_skills`) when a parent entity is legally deleted.
   - Restrict Policies (`ON DELETE RESTRICT`): Applied to historical references (`bookings` referencing `availability_slots`, `recommendations` referencing `careers`). A career cannot be deleted from the database if student recommendations point to it.
2. **Unique Constraints (`UNIQUE`):**
   - `users(email)`: Prevents duplicate account registrations.
   - `careers(slug)`: Guarantees clean, canonical routing URLs (`/careers/ai-research-scientist`).
   - `questions(assessment_id, position)`: Prevents question position collisions.
   - `answers(attempt_id, question_id)`: Enforces exactly one answer per question in an attempt.
   - `recommendations(attempt_id, career_id)`: Prevents duplicate recommendations for the same career in a single attempt.
   - `email_outbox(idempotency_key)`: Guarantees idempotent notification dispatch.
3. **Domain Check Constraints (`CHECK`):**
   - `availability_slots`: `CHECK (ends_at > starts_at)` guarantees invalid negative or zero-duration consultation slots cannot be published.

---

## 2. Indexing Strategy & Performance Considerations

Without proper indexing, queries on large tables degrade to costly Sequential Scans (`O(N)`). CareerCompass establishes targeted **B-Tree Indexes** based on query access patterns:

| Index Name | Table & Columns | Type | Target Query Workload / Optimization |
|---|---|---|---|
| `idx_users_email` | `users(email)` | Unique B-Tree | High-frequency login lookup (`WHERE email = :email`). Optimizes auth to `O(log N)`. |
| `idx_attempts_student_id` | `assessment_attempts(student_id)` | B-Tree | Student dashboard loading historical assessments (`WHERE student_id = :id`). |
| `idx_slots_counsellor_starts` | `availability_slots(counsellor_id, starts_at)` | Composite B-Tree | Fetching a counsellor's upcoming calendar filtered by date range. |
| `idx_slots_status` | `availability_slots(status)` | B-Tree | Finding all `'AVAILABLE'` slots across the school directory. |
| `idx_bookings_slot_id` | `bookings(slot_id)` | B-Tree | Verifying existing reservation status during booking flow. |
| `idx_careers_published` | `careers(published)` | B-Tree | Public catalog queries filtering out draft or unverified careers. |
| `idx_outbox_status_next` | `email_outbox(status, next_attempt_at)` | Composite B-Tree | Background worker polling for pending transactional emails ready for dispatch. |
| `guidance_sessions_student_updated` | MongoDB `guidance_sessions(studentId: 1, updatedAt: -1)` | Compound B-Tree | Fetching a student's recent AI guidance threads sorted chronologically. |

---

## 3. Concurrency & Race Condition Elimination

### The Problem: Double-Booking in Appointment Schedulers
In school counselling portals, during peak slot release periods, two students may attempt to book the same 10:00 AM slot within milliseconds of each other. A naive check-then-insert approach:
```sql
-- NAIVE APPROACH (VULNERABLE TO RACE CONDITIONS)
SELECT status FROM availability_slots WHERE id = :slotId;
-- (Context switch occurs, second student checks and also sees 'AVAILABLE')
INSERT INTO bookings (student_id, slot_id) VALUES (:studentId, :slotId);
```

### The CareerCompass Solution: Atomic Conditional SQL Execution
CareerCompass eliminates this race condition entirely by executing an atomic conditional status flip inside an interactive database transaction:
```sql
UPDATE availability_slots
SET status = 'BOOKED'
WHERE id = :slotId::uuid AND status = 'AVAILABLE';
```
- In PostgreSQL, row-level locks are acquired immediately during the `UPDATE`.
- If two transactions compete for the same row, the second transaction is blocked until the first completes.
- When the second transaction resumes, `status = 'AVAILABLE'` evaluates to `FALSE`, resulting in `0 rows updated`.
- The application detects this and rolls back, returning an RFC 7807 `409 Conflict: Slot is unavailable`.

---

## 4. Scalability & Growth Engineering

As student enrollment and data volume grow, the database design supports horizontal and vertical scaling:

1. **Connection Pooling:**
   - PostgreSQL connections are managed via Prisma's integrated connection pool, preventing connection exhaustion under concurrent student load.
2. **Data Retention & Partitioning Strategy:**
   - **Guidance Sessions (MongoDB):** Background maintenance purges sessions older than 180 days (`GUIDANCE_RETENTION_DAYS`), maintaining lightweight index footprints.
   - **Assessment Attempts (PostgreSQL):** For institutional deployments exceeding 100,000 students, the `assessment_attempts` and `answers` tables are structured with synthetic UUIDs and timestamps, enabling future PostgreSQL Table Partitioning by academic year (`started_at`).
3. **Decoupled Architecture Resilience:**
   - Heavy conversational AI transcripts are kept out of PostgreSQL WAL logs, ensuring transactional database backups remain compact, fast, and restore-ready.
