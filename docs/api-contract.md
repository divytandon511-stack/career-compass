# CareerCompass — REST API Contract

**Status:** Proposed contract; not implemented  
**Version:** v1 · 11 November 2026  
**Base URL (development):** `http://localhost:4000/api/v1`  
**Transport:** HTTPS in production; JSON; UTC ISO-8601 timestamps; UUID identifiers

## 1. Conventions

**Success:** `{"data": {...}, "meta": {...}}` (`meta` omitted for non-list responses). For collection responses, `data` is an array.

**Error:**
```json
{"error":{"code":"VALIDATION_ERROR","message":"Please correct the supplied fields.","details":[{"field":"email","issue":"Invalid email format"}],"requestId":"req_demo_001"}}
```

**Collection metadata:** `{"page":1,"limit":20,"total":83,"totalPages":5}`. `page>=1`, `limit=1..50` (default 20), `order=asc|desc`; `sort` must be a documented allowlisted field. Empty collection returns `data:[]` and metadata, not 404.

**Auth:** `Authorization: Bearer <access_token>` for protected routes; refresh cookie is HttpOnly/Secure in production. Student requests act on the authenticated student by default, not an arbitrary submitted `studentId`. Roles: `PUBLIC`, `STUDENT`, `COUNSELLOR`, `ADMIN`, `AUTH` (any authenticated role).

**Status codes:** 200 read/update; 201 created; 204 deleted/logout where appropriate; 400 malformed request; 401 missing/invalid auth; 403 insufficient role; 404 unavailable resource; 409 state/uniqueness conflict; 422 valid JSON with invalid domain values; 429 rate limit; 500 internal; 503 external dependency unavailable. All errors follow the error envelope.

**Identifiers:** UUID strings. API returns camelCase JSON; persistence uses corresponding Prisma model IDs. All date-time fields are ISO-8601 UTC. No secrets, hashes, refresh tokens, or internal database metadata in responses.

## 2. Authentication and profile
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | PUBLIC | `{email,password,displayName,schoolGrade?,consentAccepted}` | 201 `{user:{id,email,role}}` | 409,422,429 |
| POST | `/auth/login` | PUBLIC | `{email,password}` | 200 `{accessToken,expiresIn,user}`; sets refresh cookie | 401,429 |
| POST | `/auth/refresh` | PUBLIC with valid refresh cookie | cookie; CSRF control if required | 200 `{accessToken,expiresIn}`; rotates cookie | 401,429 |
| POST | `/auth/logout` | AUTH / valid refresh session | cookie | 204, clears/revokes session | 401 |
| GET | `/auth/me` | AUTH | none | 200 `{user}` | 401 |
| GET | `/users/me` | AUTH | none | 200 `{id,email,displayName,role,profile}` | 401 |
| PATCH | `/users/me` | AUTH | `{displayName?,schoolGrade?}` (grade student-only) | 200 updated profile | 401,422 |
| GET | `/admin/users` | ADMIN | `page,limit,role?,status?,sort=createdAt|email,order` | 200 paged users | 401,403,422 |
| PATCH | `/admin/users/:id/status` | ADMIN | `{status:"ACTIVE"|"SUSPENDED"}` | 200 user summary | 401,403,404,409 |

Registration always assigns `STUDENT`; privileged role provisioning is admin-controlled and not exposed via self-registration. `consentAccepted` must be true under approved policy; requirements for minors remain pending mentor confirmation. `displayName` length 1–100; password minimum 12 characters, maximum 128 bytes; email normalized, valid, unique. No password in response.

**Login example:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{"email":"student@example.test","password":"ExampleOnlyPassword123!"}
```
```json
{"data":{"accessToken":"<signed-access-token>","expiresIn":900,"user":{"id":"11111111-1111-4111-8111-111111111111","email":"student@example.test","role":"STUDENT"}}}
```
Refresh token is sent as a cookie, not in the JSON body. The example password is synthetic; never store sample credentials in a production seed.

## 3. Assessment definitions and questions
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/assessments` | AUTH | `page,limit,status?,sort=title|createdAt,order` | 200 paged published assessments (admin may see drafts) | 401,422 |
| GET | `/assessments/:id` | AUTH | ID | 200 assessment summary/version | 401,404 |
| GET | `/assessments/:id/questions` | STUDENT,ADMIN | `page,limit` | 200 questions with options but **no scoring keys** for students | 401,403,404 |
| POST | `/assessments` | ADMIN | `{title,description,version}` | 201 assessment | 401,403,422 |
| PATCH | `/assessments/:id` | ADMIN | mutable draft fields | 200 updated draft | 403,404,409,422 |
| POST | `/assessments/:id/questions` | ADMIN | `{prompt,dimension,weight,position,options:[{id,label,value}]}` | 201 question | 403,404,409,422 |
| PATCH | `/questions/:id` | ADMIN | draft question fields | 200 question | 403,404,409,422 |

Published assessment versions are immutable; editing requires a new version. Question dimensions belong to the fixed, versioned dimension set. `weight>0`, `value` integer 0..4, at least two options, unique position per assessment. Never expose option `value` or internal weights to student endpoints if it would compromise assessment integrity; student submits option IDs.

## 4. Assessment attempts and answers
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| POST | `/assessments/:id/attempts` | STUDENT | none | 201 `{id,assessmentId,status:"IN_PROGRESS",startedAt}` | 401,403,404,409 |
| GET | `/attempts` | STUDENT | `page,limit,status?,sort=startedAt|completedAt,order` | 200 **own** attempts | 401,403,422 |
| GET | `/attempts/:id` | STUDENT | ID | 200 own attempt, answers/status | 401,404 |
| PUT | `/attempts/:id/answers/:questionId` | STUDENT | `{optionId}` | 200 saved answer | 401,404,409,422 |
| POST | `/attempts/:id/submit` | STUDENT | optional `{}` | 200 finalized scores and recommendations link | 401,404,409,422 |

Only the owning student can change an `IN_PROGRESS` attempt. Answer PUT is idempotent for the same option and cannot update after submission. Submission verifies every required question, scores server-side, and persists SQL attempt scores and ranked recommendations atomically. Concurrent double submit must not create duplicate recommendations.

**Submit response example:**
```json
{"data":{"attemptId":"22222222-2222-4222-8222-222222222222","status":"COMPLETED","assessmentVersion":1,"algorithmVersion":"cosine-v1","dimensionScores":{"ANALYTICAL":0.9,"CREATIVE":0.3,"SOCIAL":0.6,"PRACTICAL":0.4,"ORGANIZATIONAL":0.5,"INVESTIGATIVE":0.8},"completedAt":"2026-11-11T10:00:00Z","recommendationsUrl":"/api/v1/attempts/22222222-2222-4222-8222-222222222222/recommendations"}}
```

## 5. Recommendations and saved careers
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/attempts/:id/recommendations` | STUDENT | `page,limit` | 200 own ranked recommendations | 401,404,409 |
| GET | `/users/me/saved-careers` | STUDENT | `page,limit,sort=savedAt|title,order` | 200 saved careers | 401,403 |
| PUT | `/users/me/saved-careers/:careerId` | STUDENT | none | 200 saved state (idempotent) | 401,404 |
| DELETE | `/users/me/saved-careers/:careerId` | STUDENT | none | 204 (idempotent) | 401 |

**Recommendation response example:**
```json
{"data":[{"career":{"id":"33333333-3333-4333-8333-333333333333","slug":"software-developer","title":"Software Developer"},"rank":1,"similarityScore":0.92,"algorithmVersion":"cosine-v1","reasons":["Strong alignment with analytical interests","Strong alignment with investigative interests"],"cautions":["Explore day-to-day work before deciding"]}],"meta":{"page":1,"limit":20,"total":1,"totalPages":1}}
```
`similarityScore` is a vector similarity, not a probability of career success. Results reference a completed own attempt. Ranking is deterministic: score descending then slug ascending.

## 6. Career catalogue, skills and pathways
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/careers` | PUBLIC | `page,limit,q?,skillId?,published?,sort=title|createdAt,order` | 200 paged published careers; admin can filter drafts | 422 |
| GET | `/careers/:idOrSlug` | PUBLIC | ID or slug | 200 career detail with verified pathways | 404 |
| POST | `/careers` | ADMIN | `{slug,title,description,dimensionProfile,skillIds?,pathways?}` | 201 career | 401,403,409,422 |
| PATCH | `/careers/:id` | ADMIN | allowed mutable fields | 200 updated career | 403,404,409,422 |
| DELETE | `/careers/:id` | ADMIN | none | 204 soft-archive/unpublish | 403,404,409 |
| GET | `/skills` | PUBLIC | `page,limit,q?,sort=name,order` | 200 paged skills | 422 |
| POST | `/skills` | ADMIN | `{name}` | 201 skill | 403,409,422 |
| GET | `/careers/:id/pathways` | PUBLIC | `page,limit` | 200 pathways | 404 |
| POST | `/careers/:id/pathways` | ADMIN | `{stage,qualification,notes,verifiedAt?}` | 201 pathway | 403,404,422 |
| PATCH | `/pathways/:id` | ADMIN | mutable fields | 200 pathway | 403,404,422 |

`slug` lowercase kebab-case, unique; `title` 2..120 chars; `dimensionProfile` must contain every supported dimension, each finite in `[0,1]`, at least one nonzero. Published catalogue records must be human-reviewed and include a source/verification note in the database design. No unverified salary/admission claims.

**Career list example:**
```http
GET /api/v1/careers?q=software&sort=title&order=asc&page=1&limit=10
```
```json
{"data":[{"id":"33333333-3333-4333-8333-333333333333","slug":"software-developer","title":"Software Developer","summary":"Designs and builds software systems."}],"meta":{"page":1,"limit":10,"total":1,"totalPages":1}}
```

## 7. Counsellors, slots and bookings
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/counsellors` | AUTH | `page,limit,q?,sort=displayName,order` | 200 active counsellors | 401 |
| GET | `/counsellors/:id` | AUTH | ID | 200 public profile | 401,404 |
| GET | `/counsellors/:id/slots` | AUTH | `from,to,page,limit` | 200 available future slots | 401,404,422 |
| POST | `/counsellors/me/slots` | COUNSELLOR | `{startsAt,endsAt}` | 201 slot | 401,403,409,422 |
| DELETE | `/counsellors/me/slots/:id` | COUNSELLOR | ID | 204 if unbooked | 403,404,409 |
| POST | `/bookings` | STUDENT | `{slotId,note?}` | 201 booking | 401,403,404,409,422 |
| GET | `/bookings` | STUDENT,COUNSELLOR | `page,limit,status?,sort=createdAt|startsAt,order` | 200 own bookings / assigned bookings | 401,403 |
| GET | `/bookings/:id` | STUDENT,COUNSELLOR | ID | 200 own/assigned booking | 401,404 |
| PATCH | `/bookings/:id/status` | STUDENT,COUNSELLOR | `{status}` | 200 updated booking | 401,403,404,409,422 |

Booking note max 500 characters and should exclude sensitive data. Students may cancel their own confirmed bookings; counsellors may mark assigned bookings `COMPLETED` or `CANCELLED` according to allowed state transitions. Clients cannot directly set arbitrary status.

**Booking example:**
```http
POST /api/v1/bookings
Authorization: Bearer <access_token>
Content-Type: application/json

{"slotId":"44444444-4444-4444-8444-444444444444","note":"I'd like to discuss science-related careers."}
```
```json
{"data":{"id":"55555555-5555-4555-8555-555555555555","slotId":"44444444-4444-4444-8444-444444444444","status":"CONFIRMED","startsAt":"2026-11-15T09:00:00Z","notificationStatus":"PENDING"}}
```
**Concurrency rule:** SQL transaction must atomically reserve a slot, with database uniqueness/conditional state update. Exactly one concurrent request succeeds; other receives `409 SLOT_UNAVAILABLE`. Repeated same request can use optional `Idempotency-Key` (UUID, scoped to user and route, retained 24h); replay returns same result. Email dispatch occurs asynchronously from an outbox and does not roll back confirmed bookings.

## 8. AI guidance and MongoDB history
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| POST | `/guidance/sessions` | STUDENT | `{attemptId,careerIds:[...]}` | 201 `{sessionId,createdAt}` | 401,404,409,422,503 |
| GET | `/guidance/sessions` | STUDENT | `page,limit,sort=updatedAt,order` | 200 own sessions | 401,503 |
| GET | `/guidance/sessions/:id` | STUDENT | ID | 200 own session/messages | 401,404,503 |
| POST | `/guidance/sessions/:id/messages` | STUDENT | `{message}` | 200 AI answer with grounded career IDs | 401,404,422,429,503 |
| DELETE | `/guidance/sessions/:id` | STUDENT | ID | 204 delete own session | 401,404,503 |

Only completed own `attemptId` and published career IDs are allowed. Message length 1..1000 characters; session history bounded (e.g. 20 messages for prompt context). Minimize personal data; do not send email, DOB, student name or assessment raw answers to the LLM. AI narrative uses curated career records and dimension scores, not arbitrary model-generated facts. Store only approved content in MongoDB and define retention/deletion policy. If Mongo unavailable, history endpoints return `503`; if LLM unavailable, messages endpoint returns `503 AI_UNAVAILABLE`, while recommendation endpoints still work.

**Guidance example:**
```json
{"data":{"sessionId":"guidance_demo_001","message":{"role":"assistant","text":"Your analytical and investigative interests align with aspects of software development. Consider exploring a beginner coding project and speaking with a counsellor.","groundingCareerIds":["33333333-3333-4333-8333-333333333333"],"generatedByAI":true,"createdAt":"2026-11-11T10:05:00Z"}}}
```

## 9. Analytics and operations
| Method | Endpoint | Access | Input | Success | Errors |
|---|---|---|---|---|---|
| GET | `/analytics/overview` | ADMIN | `from?,to?` | 200 aggregate assessment/booking/career metrics | 401,403,422 |
| GET | `/analytics/career-interests` | ADMIN | `from?,to?,page,limit` | 200 aggregate interest distribution | 401,403,422 |
| GET | `/health` | PUBLIC | none | 200 `{status:"ok"}` | 500 |
| GET | `/ready` | PUBLIC | none | 200 `{status:"ready"}` or 503 | 503 |

Suppress small groups (proposed minimum count 5) and exclude student-identifying fields from analytics. Date range maximum proposed 365 days. `health` and `ready` are outside `/api/v1` at the server root and reveal no secrets.

## 10. Error, privacy and security contract
- Every endpoint validates path/query/body; invalid enums, malformed UUIDs, out-of-range pagination, non-UTC timestamps and unknown mutable fields are rejected.
- Protected object lookups include current user ID/role in repository query. `GET /attempts/:id` and `GET /guidance/sessions/:id` must not expose another student's data; use `404` to avoid enumeration.
- Authentication endpoints have tighter per-IP/account rate limits; AI guidance has per-user quota; return `429` with `Retry-After` when applicable.
- Structured logs include request ID, method, route, status, duration, anonymized user ID where needed; **never** passwords, tokens, full answers, AI prompts or raw student PII.
- Do not send cookies across untrusted origins. Configure CORS allowlist, secure refresh cookie, CSRF strategy, HTTPS and secret rotation before deployment.
- Student deletion/retention policy, consent for minors and school data handling require mentor/school approval; use synthetic data in demo.

## 11. Acceptance test matrix
| Scenario | Expected |
|---|---|
| Student logs in and refreshes | Short-lived access token, rotated refresh token, old refresh rejected |
| Student logs out | Refresh revoked; access expires within configured TTL |
| Student requests another student's attempt | 404, no data leaked |
| Student attempts admin career creation | 403 |
| Student submits incomplete assessment | 422, no partial finalized result |
| Zero vector / tied cosine scores | No crash; deterministic results and documented fallback |
| Careers pagination/filter/sort | Stable order, correct metadata, validated fields |
| Two students book same slot concurrently | One 201; one 409; exactly one active booking |
| Email provider unavailable | Booking remains confirmed, notification queued/retried |
| AI provider unavailable | Guidance 503; normal recommendation API unaffected |
| MongoDB unavailable | SQL-backed assessment and booking still work |
| Invalid input and throttling | Consistent 422/429 error envelope |
| Admin analytics for tiny group | Suppressed aggregates, no identifying details |

## 12. Traceability and unresolved decisions
This contract supports ASD layered services, resource-oriented REST, versioning, pagination/filtering/sorting, auth/expiry/logout, RBAC/ownership, validation/errors, security, AI and email integrations, tests/logging and deployment documentation. DE evidence will include relational DDL/joins/aggregations/subqueries, Prisma CRUD/relations and MongoDB CRUD/aggregation. ISD evidence requires an implemented, usable, stable interface and authentic development history; **whether React web alone satisfies the integrated offline ISD requirement must be confirmed with the mentor**.

**Before coding, agree on:** multi-school tenancy; minor consent and retention; exact assessment question set and dimension taxonomy; admin role provisioning; cancellation policy; assessment versioning; LLM/email providers and deployment constraints; final Prisma entity names. The API is a proposal and must be reconciled with Aradhya's ERD and Dhavika's UI design.
