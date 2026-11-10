# CareerCompass — System Architecture

**Status:** Proposed design, not implemented  
**Version:** 1.0 · 11 November 2026  
**Project:** Develop Effective Career Counselling and Guidance Programs in Schools to Enhance Student Career Choices

## 1. Purpose and scope
CareerCompass helps school students understand interests and strengths, explore educational pathways, receive **explainable, non-deterministic** career suggestions, and request counsellor appointments. Counsellors manage assigned sessions; admins maintain reference data and view privacy-preserving aggregate trends. The system is guidance, not a psychological diagnosis or guarantee of career suitability.

### MVP acceptance journeys
1. Student registers, verifies eligibility/consent as required by school policy, logs in, completes an assessment, and receives ranked recommendations with reasons.
2. Student searches/filter careers, opens a career detail with skills and educational pathways, and saves a career.
3. Student requests an available counsellor slot; duplicate or competing bookings cannot reserve the same slot; student can cancel and counsellor can update permitted status.
4. Student requests an AI explanation grounded in assessment scores and curated career data; unavailable AI does not block core recommendations.
5. Admin manages career/question catalogue and views aggregate metrics; students cannot access others' results.

### Out of scope for MVP
Psychometric certification, guaranteed placement outcomes, live video counselling, automated high-stakes decisions, payments, full school SIS integration, and AI-generated factual career records without verification.

## 2. Technology decisions
| Layer | Choice | Reason |
|---|---|---|
| Web client | React + Vite | Component-based responsive interface |
| API | Node.js + Express | Versioned REST, clear middleware boundaries |
| SQL | PostgreSQL | Transactional users, catalogue, bookings, assessment definitions/results |
| ORM | Prisma | Typed relational models, migrations and seeds |
| Document DB | MongoDB + Mongoose | Flexible AI guidance conversations and immutable assessment event snapshots |
| Auth | Argon2id or bcrypt, short-lived JWT access token, rotated refresh tokens | Password safety and revocation |
| AI | Configurable external LLM provider, backend only | Grounded narrative explanations; no direct browser API key |
| Email | Configurable transactional email adapter | Booking confirmation notifications |
| Tests | Vitest or Jest, Supertest | Unit and integration coverage |

**Source of truth:** PostgreSQL is authoritative for users, roles, career catalogue, assessment definitions, finalized attempt scores/recommendations, slots and bookings. MongoDB stores optional append-only attempt events and AI guidance exchanges. Mongo records reference SQL IDs but never determine authorization or booking availability. A Mongo outage must not corrupt SQL state.

## 3. Layered architecture

```text
career-compass/
├── frontend/                       # React/Vite; no direct DB access
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── app.ts                  # Express assembly, security middleware
│   │   ├── server.ts               # startup/shutdown, DB readiness
│   │   ├── config/                 # validated environment settings
│   │   ├── middleware/             # auth, role/ownership, validation, errors, rate limit
│   │   ├── lib/                    # Prisma/Mongoose clients, logger
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── assessments/
│   │   │   ├── recommendations/
│   │   │   ├── careers/
│   │   │   ├── counsellors/
│   │   │   ├── bookings/
│   │   │   ├── guidance/
│   │   │   └── analytics/
│   │   ├── integrations/           # LLM, email, retry/outbox workers
│   │   └── shared/                 # DTOs, pagination, errors
│   └── tests/
├── database/                       # ERD, SQL query evidence, Mongo scripts
└── docs/                           # design, API contract, deployment, test evidence
```

Each module uses **route → validation/auth middleware → controller → service → repository**. Controllers handle HTTP; services enforce business rules; repositories encapsulate Prisma/Mongoose; integrations wrap third-party services. No raw database access from routes or React. Use dependency injection for testable recommendation, email and LLM adapters.

### Team module ownership (coordination, not exclusive knowledge)
- **Divy — Applied Mathematics/backend:** auth, assessment scoring, recommendations, analytics, backend security/testing, architecture.
- **Aradhya — Entrepreneurship/data:** career catalogue, pathways, counsellor booking domain, SQL/Prisma modelling, data validation, feasibility.
- **Dhavika — ISD/application:** React UI, accessibility, dashboard, guidance experience and Mongo history integration.

All three review integration PRs and understand the entire system for the viva. Each commit must truthfully represent its author.

## 4. Roles and authorization
- `STUDENT`: self-profile, own assessment attempts/results, saved careers, own bookings and guidance sessions; browse published careers and counsellor slots.
- `COUNSELLOR`: self-profile, own availability, bookings assigned to them, limited student booking context needed for guidance; cannot browse all student assessments.
- `ADMIN`: catalogue and assessment/question management, account role administration through controlled endpoints, aggregate analytics; raw student answers only if explicitly authorized and justified.
- **Default deny:** check role **and resource ownership** at service/database query level (`WHERE studentId = currentUser.id`, `WHERE counsellorId = currentUser.id`). Never trust `userId` in a request body as proof of identity. Return `404` for unauthorized resource enumeration where appropriate; `403` for known forbidden operations.
- School-scoped tenancy is a **decision pending**. MVP may use one school/demo cohort; if multi-school support is required, add `schoolId` to all relevant tables and every query, plus tenant-scoped RBAC, before coding.

## 5. Relational data model — conceptual
| Entity | Essential fields / constraints | Relations |
|---|---|---|
| `User` | UUID id, unique email, passwordHash, role, status, createdAt | 1:0..1 StudentProfile or CounsellorProfile |
| `StudentProfile` | userId PK/FK, schoolGrade, optional schoolId, consent flags | 1:N AssessmentAttempt, Booking, SavedCareer |
| `CounsellorProfile` | userId PK/FK, displayName, bio, active | 1:N AvailabilitySlot, Booking |
| `Assessment` | id, title, version, status | 1:N Question, AssessmentAttempt |
| `Question` | id, assessmentId, dimension, prompt, position, weight, options | N:1 Assessment |
| `AssessmentAttempt` | id, studentId, assessmentId, version, status, startedAt, completedAt, scoresJson | 1:N Answer, Recommendation |
| `Answer` | attemptId + questionId unique, selectedOption/score | N:1 Attempt, N:1 Question |
| `Career` | id, slug unique, title, description, published | N:M Skill via CareerSkill; 1:N Pathway |
| `Skill` / `CareerSkill` | skill id; (careerId, skillId) unique, weight | N:M Careers |
| `CareerDimension` | careerId + dimension unique, targetWeight [0,1] | N:1 Career; matching vector |
| `EducationPathway` | careerId, stage, qualification, notes, verifiedAt | N:1 Career |
| `Recommendation` | attemptId + careerId unique, rank, score, explanationJson, algorithmVersion | N:1 Attempt/Career |
| `SavedCareer` | studentId + careerId unique | N:1 Student/Career |
| `AvailabilitySlot` | counsellorId, startsAt, endsAt, status | 1:0..1 active Booking |
| `Booking` | id, studentId, counsellorId, slotId, status, createdAt | N:1 Student/Counsellor; slot uniqueness |
| `RefreshSession` | id, userId, hashedTokenId, expiresAt, revokedAt, rotatedFrom | N:1 User |
| `EmailOutbox` | id, eventType, payload, status, attempts, nextAttemptAt | reliable notification dispatch |

Use UTC timestamps, database foreign keys and unique constraints. Preserve assessment and career **version** context so historical results remain interpretable after catalogue changes. Prisma migrations and seed data must be committed; secrets and live student data must not.

## 6. MongoDB design
- `assessment_events`: `{ _id, attemptId, studentId, assessmentVersion, eventType, occurredAt, metadata }` for optional diagnostics/audit of progress; no authoritative scores. Index `{attemptId:1, occurredAt:1}` and enforce retention.
- `guidance_sessions`: `{ _id, sessionId, studentId, attemptId, careerIds, createdAt, updatedAt, messages:[{role, text, createdAt, groundingCareerIds}], model, consentVersion }`. Index `{studentId:1, updatedAt:-1}`. Apply bounded history, retention and deletion policy; avoid storing names, phone numbers or unnecessary free-text PII.
- Do not implement distributed SQL+Mongo transactions. Persist SQL result first; write Mongo event best-effort with retry. Guidance persistence failure should be surfaced as a non-blocking warning or return a documented error according to endpoint contract.
- Mongo collections require documented insert/find/update/delete and aggregation examples in `database/` for DE evidence.

## 7. Assessment and mathematical matching
**Dimensions (proposed):** `ANALYTICAL`, `CREATIVE`, `SOCIAL`, `PRACTICAL`, `ORGANIZATIONAL`, `INVESTIGATIVE`. These are product-defined interest dimensions, **not a validated psychometric instrument**. Question and career vectors must use the same fixed dimension order and version.

1. Each question offers ordered options mapped to values `0..4`; score is validated server-side against the question's stored options.
2. For each dimension `d`, compute `raw_d = Σ(answerValue_q × weight_q)` and `max_d = Σ(4 × weight_q)` for answered required questions. Normalize `student_d = raw_d / max_d`, in `[0,1]`. Reject incomplete required submissions instead of silently altering denominators.
3. Each curated career has a nonnegative vector `career_d ∈ [0,1]` with at least one nonzero element, reviewed by the catalogue owner.
4. Weighted cosine similarity: `similarity(s,c) = Σ_d w_d s_d c_d / (sqrt(Σ_d w_d s_d²) × sqrt(Σ_d w_d c_d²))`, with `w_d > 0`, default all 1. If either norm is zero, return score `0` and mark low-information assessment; never divide by zero.
5. Sort descending similarity; tie-break by career slug/ID for deterministic output. Persist `algorithmVersion`, `assessmentVersion`, raw dimension scores, normalized vector, rank and similarity (0..1). Do **not** display similarity as probability of success or suitability.
6. Explain top contributing dimensions and mismatches from actual vector data; allow student to compare alternatives. Do not use protected traits, identity, socioeconomic status or demographic proxies to rank careers.

**Example:** If normalized student scores are `ANALYTICAL=.9, CREATIVE=.3` and a career profile is `.8, .2`, cosine is high because vector directions align. This is a similarity measure, not a validated career prediction.

### Analytics
Count assessments, top interest dimensions, booking utilization and career saves. Use minimum group-size suppression (proposed `k=5`) for school dashboards, no raw identifiers in aggregate responses, no publicly exposed individual rankings. Add school-level scope if multi-tenant.

## 8. Authentication lifecycle
1. `POST /auth/register`: validate, normalize email, hash password with Argon2id (or configured bcrypt), default `STUDENT`; no self-assigned privileged roles. School/guardian consent and age policy need mentor confirmation.
2. `POST /auth/login`: rate-limit; generic invalid-credential message; issue signed access JWT (proposed 15 minutes) and opaque random refresh token (proposed 7 days). Store only refresh-token hash and session metadata.
3. Refresh token in `HttpOnly`, `Secure` (production), appropriate `SameSite` cookie; use CSRF protection or strict same-site strategy as applicable. Access token preferably held in memory, not localStorage.
4. `POST /auth/refresh`: rotate refresh token atomically; revoke old token; detect reuse and revoke affected token family. Access JWT includes user ID, role and expiry; verify signature, issuer, audience, status.
5. `POST /auth/logout`: revoke current refresh session, clear cookie. Existing access token may remain valid until short expiry unless denylist/revocation strategy is added; document this explicitly.
6. `GET /auth/me` checks active user status and returns minimal profile. Password resets and email verification are desirable extensions; MVP readiness must be reviewed.

## 9. API and operational standards
- Base path `/api/v1`; JSON content type; standard envelope `{data, meta?}` and errors `{error:{code,message,details?,requestId}}`.
- Collection endpoints use `page` (>=1), `limit` (1..50, default 20), allowlisted `sort` fields and `order=asc|desc`; include `{page,limit,total,totalPages}`. Search/filters use validated query parameters and parameterized ORM queries.
- Validate request params, query and body (Zod or equivalent); reject unknown sensitive fields, cap request sizes, sanitize output, no stack traces to clients.
- `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `422` semantic validation, `429` throttled, `500` internal, `503` unavailable dependency.
- CORS restricted to configured frontend origin(s); `helmet`, HTTPS, secret management, structured logs with request IDs and PII redaction; per-IP and per-account rate limiting, stricter auth and AI endpoints.
- Expose `GET /health` (liveness) and `GET /ready` (dependency readiness) without secrets.

## 10. Booking correctness and email
- Counsellor creates future, non-overlapping slots; store UTC and show local timezone in UI.
- Student books a slot via one PostgreSQL transaction: verify available, prevent double booking using a unique active-slot constraint or atomic conditional update plus unique index, create booking, mark slot booked, write `EmailOutbox` event. Do not rely on UI disabling alone.
- Booking cancellation updates status and slot availability atomically; define cutoff policy (proposed no cutoff in demo MVP, pending approval). Concurrency tests must simulate two students booking the same slot.
- Outbox worker sends email asynchronously with retries/backoff and idempotency key. If email fails, **booking remains confirmed**; show notification status separately. Never include sensitive assessment answers in email.

## 11. AI career guidance
- AI generates **explanations**, not the numeric career ranking. Backend supplies selected, verified career summaries and relevant non-identifying dimension scores; redact free text, cap prompt size, require consent where needed.
- System prompt instructs AI to ground claims in supplied catalogue facts, acknowledge missing facts and avoid certainty, bias, medical/psychological claims and invented salary/admission requirements. Show a visible 'AI-generated guidance' label.
- Rate-limit and set timeouts; log only non-sensitive telemetry. If LLM fails, return `503 AI_UNAVAILABLE` for guidance endpoint while recommendations and career browsing remain available.
- Prevent prompt injection from user notes and catalogue content through clear data delimiters and output validation. Never send database credentials or entire student records to the provider.

## 12. Testing, deployment and evidence
- **Unit:** scoring normalization, cosine ties/zero vector, RBAC policy, booking policy, validators.
- **Integration:** register/login/refresh/logout, own-vs-other attempts, filters/pagination/sorting, career CRUD, booking race/cancellation, Mongo guidance CRUD/aggregation, AI/email failure.
- **E2E:** student assessment → recommendation → explore → booking; counsellor session management; admin catalogue/analytics.
- Seed realistic synthetic users/careers/questions and sample documents. Use test databases, never production records.
- CI: lint, typecheck (if TS), unit/integration tests, migration validation, secret scan. Deployment documentation: env example, setup, migration/seed, service URLs, API reference, demo credentials (synthetic only), known limitations, rollback/backup.
- Daily genuine Git commits and reviewed PRs; preserve test screenshots/logs, API examples, ERD, SQL scripts, ORM models and Mongo operations for rubric/viva evidence.

### Rubric traceability
| Rubric area | Planned evidence |
|---|---|
| ASD layered architecture | module structure, route/controller/service/repository examples |
| ASD REST | `/api/v1` contracts, pagination/filter/sort and status codes |
| ASD relational data | PostgreSQL ERD, Prisma migrations, seeds |
| ASD authentication | password hashing, JWT expiry, refresh rotation, logout tests |
| ASD authorization | RBAC and ownership negative tests |
| ASD validation/errors | schemas, centralized error responses |
| ASD security | CORS, rate limiting, secure config, logs |
| ASD advanced capabilities | LLM explanation + email notifications |
| ASD deployment/docs | live demo, setup, OpenAPI/API docs |
| ASD testing/logging | automated suites and structured request logs |
| DE SQL | ERD, DDL, CRUD, JOIN, aggregate, subquery examples |
| DE ORM | Prisma relationships, migrations and CRUD evidence |
| DE MongoDB | collections, sample documents, CRUD and aggregation evidence |
| ISD | working usable/stable app, development history, screen and test evidence |

## 13. Decisions to resolve before implementation
1. **ISD applicability:** Does a responsive web client satisfy the integrated ISD requirement for Dhavika's offline track, or is a separate desktop/mobile/terminal deliverable required? Confirm with mentor; do not conflate portal assignments with shared capstone.
2. **Student age/consent:** school-approved privacy, guardian consent, retention/deletion rules and whether real student data may be used. Prefer synthetic data for demo.
3. **Tenancy:** one school/demo cohort versus multi-school roles and `schoolId` scoping.
4. **Assessment:** exact questions, dimension weights and career-vector curation/validation; do not claim scientific validation.
5. **Booking:** timezone, cancellation cutoff, slot duration and whether counsellors are actual school staff.
6. **Infrastructure:** hosted PostgreSQL/MongoDB, LLM and email provider, deployment budget and secrets.
7. **Rubric interpretation:** confirm exact evidence/submission deadlines in ADCMS portal.

**Implementation gate:** Database schema, API contract and UI page flows must be reconciled before code generation; this document is a proposal, not proof of completed functionality.
