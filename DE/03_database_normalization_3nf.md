# 03. Database Normalization & Form Progression (1NF to 3NF)

**Project:** CareerCompass — Secondary School Guidance Platform
**Component:** Data Engineering Deliverable #3
**Author:** Aradhya Tiwari (Data Engineering Lead)

---

## 1. Relational Database Normalization (PostgreSQL)

To prevent data redundancy, eliminate operational anomalies, and guarantee referential integrity, the CareerCompass relational schema is formally normalized to **Third Normal Form (3NF)**.

---

### Step 0: The Un-Normalized Form (UNF) & Its Anomalies

Consider an un-normalized, flat student career guidance record representing an entire student experience:

```text
STUDENT_GUIDANCE_UNF (
    student_id, student_email, student_name, school_grade,
    assessment_id, assessment_title,
    { question_pos, question_prompt, question_dimension, selected_option, question_score },
    calculated_scores,
    { recommended_career_slug, recommended_career_title, similarity_score, { required_skills }, { pathways } },
    counsellor_id, counsellor_name, counsellor_bio,
    slot_id, slot_start_time, booking_status
)
```

#### Anomalies Present in UNF:
1. **Insertion Anomaly:**
   - A new career (e.g., *Biomedical Engineer*) or assessment question cannot be added into the database without a student taking an assessment.
   - A counsellor cannot publish an open consultation slot unless a student has already booked it.
2. **Update Anomaly:**
   - If a career title or educational roadmap changes, thousands of historical student records must be updated. If any row is missed, data becomes inconsistent.
   - If a counsellor updates their bio, it must be rewritten across every past appointment record.
3. **Deletion Anomaly:**
   - If a graduating student's account is deleted, the catalog data for the careers they were recommended and the questions they answered would be permanently lost.

---

### Step 1: First Normal Form (1NF)

#### Definition of 1NF:
A relation is in 1NF if and only if:
1. There are **no repeating groups** or multivalued attributes.
2. Every column contains only **atomic (indivisible) values**.
3. Each record is uniquely identifiable by a **Primary Key**.

#### Transformations to Achieve 1NF:
1. **Eliminate Repeating Question Groups:** Extracted question definitions into a separate `questions` entity and individual student responses into an `answers` entity.
2. **Eliminate Multivalued Skills & Pathways:** Replaced comma-separated skill lists and multi-stage educational pathways with discrete entities (`skills`, `education_pathways`, and the `career_skills` associative entity).
3. **Atomic User Attributes:** Decoupled `display_name`, `email`, and credentials into discrete atomic fields.

```
[UNF: Repeating Arrays]
         │
         ├──> Extract repeating question arrays  ──> `questions`, `answers`
         ├──> Extract multivalued skills/pathways ──> `skills`, `education_pathways`, `career_skills`
         └──> Extract repeating appointments     ──> `availability_slots`, `bookings`
```

---

### Step 2: Second Normal Form (2NF)

#### Definition of 2NF:
A relation is in 2NF if and only if:
1. It is already in **1NF**.
2. **No non-prime attribute is partially dependent on any candidate key.** (Every non-key attribute must be fully functionally dependent on the entire composite primary key).

#### Identified Partial Dependencies in Composite Keys & Transformations:

#### A. The `answers` Entity
- **Composite Candidate Key:** `(attempt_id, question_id)`
- **Attributes:** `selected_option_id`, `score`, `answered_at`, `question_prompt`, `question_weight`
- **Partial Dependency:**
  $$\text{question\_id} \to \text{question\_prompt}, \text{question\_weight}$$
  *The prompt and weight depend solely on `question_id`, not on `attempt_id`.*
- **Transformation to 2NF:**
  Split into two relations:
  1. `questions(id, assessment_id, dimension, prompt, weight, options)` — where `id` is the PK.
  2. `answers(id, attempt_id, question_id, selected_option_id, score, answered_at)` — where non-key attributes (`score`, `selected_option_id`, `answered_at`) depend strictly on the combination of `(attempt_id, question_id)`.

#### B. The `recommendations` Entity
- **Composite Candidate Key:** `(attempt_id, career_id)`
- **Attributes:** `rank`, `similarity_score`, `career_title`, `career_description`, `career_slug`
- **Partial Dependency:**
  $$\text{career\_id} \to \text{career\_title}, \text{career\_description}, \text{career\_slug}$$
  *The title and description depend solely on `career_id`, not on the assessment `attempt_id`.*
- **Transformation to 2NF:**
  Retain `careers(id, slug, title, description, published)` with `id` as PK, and define `recommendations(id, attempt_id, career_id, rank, similarity_score, explanation_json)` where `rank` and `similarity_score` depend fully on the specific attempt-career pair.

#### C. The `career_skills` Entity
- **Composite Primary Key:** `(career_id, skill_id)`
- **Transformation to 2NF:**
  Contains zero non-prime attributes; it is a pure associative junction table.

---

### Step 3: Third Normal Form (3NF)

#### Definition of 3NF:
A relation is in 3NF if and only if:
1. It is already in **2NF**.
2. **No transitive dependencies exist.** (A non-prime attribute must not depend on another non-prime attribute; non-key attributes must depend on nothing but the Primary Key: $X \to Y \to Z$ is prohibited).

#### Identified Transitive Dependencies & Transformations:

#### A. User Sub-typing (`users`, `student_profiles`, `counsellor_profiles`)
- **Initial Table:** `users(id, email, password_hash, role, school_grade, bio, counsellor_active)`
- **Transitive Dependency:**
  $$\text{id} \to \text{role} \to \text{school\_grade}$$
  $$\text{id} \to \text{role} \to \text{bio}$$
  *`school_grade` is only valid when $\text{role} = \text{'STUDENT'}$; `bio` is only valid when $\text{role} = \text{'COUNSELLOR'}$. Storing them in `users` creates transitive dependency on `role` and forces high NULL density.*
- **Transformation to 3NF:**
  Created specialized 1:1 subtype tables:
  1. `users(id, email, password_hash, display_name, role, status)`
  2. `student_profiles(user_id PK/FK, school_grade, consent_accepted)`
  3. `counsellor_profiles(user_id PK/FK, display_name, bio, active)`

#### B. Appointments & Availability (`availability_slots`, `bookings`)
- **Hypothetical Denormalized Booking:** `bookings(id, student_id, counsellor_id, slot_id, starts_at, ends_at, status)`
- **Transitive Dependency:**
  $$\text{booking\_id} \to \text{slot\_id} \to \text{starts\_at}, \text{ends\_at}, \text{counsellor\_id}$$
  *The schedule timing (`starts_at`, `ends_at`) is functionally determined by `slot_id`, not by the booking itself.*
- **Transformation to 3NF:**
  Separated scheduling availability from appointment reservations:
  1. `availability_slots(id, counsellor_id, starts_at, ends_at, status)`
  2. `bookings(id, student_id, counsellor_id, slot_id, status, note)` — references `slot_id` as foreign key, removing transitive timing attributes.

---

## 2. Summary of Verified Functional Dependencies (FDs)

Every relation in the final schema satisfies Boyce-Codd / 3NF ($X \to Y$ where $X$ is a superkey):

| Relation | Functional Dependency (FD) | Determinant Status | Normal Form |
|---|---|---|:---:|
| `users` | $\text{id} \to \text{email, password\_hash, display\_name, role, status, created\_at}$ | Candidate Key | **3NF** |
| `users` | $\text{email} \to \text{id}$ | Alternate Key | **3NF** |
| `student_profiles` | $\text{user\_id} \to \text{school\_grade, consent\_accepted, created\_at}$ | Primary Key | **3NF** |
| `counsellor_profiles`| $\text{user\_id} \to \text{display\_name, bio, active, created\_at}$ | Primary Key | **3NF** |
| `assessments` | $\text{id} \to \text{title, description, version, status, created\_at}$ | Primary Key | **3NF** |
| `questions` | $\text{id} \to \text{assessment\_id, dimension, prompt, position, weight, options}$ | Primary Key | **3NF** |
| `questions` | $(\text{assessment\_id}, \text{position}) \to \text{id}$ | Alternate Key | **3NF** |
| `assessment_attempts`| $\text{id} \to \text{student\_id, assessment\_id, status, scores\_json, started\_at}$ | Primary Key | **3NF** |
| `answers` | $\text{id} \to \text{attempt\_id, question\_id, selected\_option\_id, score, answered\_at}$ | Primary Key | **3NF** |
| `answers` | $(\text{attempt\_id}, \text{question\_id}) \to \text{id, selected\_option\_id, score}$ | Alternate Key | **3NF** |
| `careers` | $\text{id} \to \text{slug, title, description, published, profile\_version}$ | Primary Key | **3NF** |
| `careers` | $\text{slug} \to \text{id}$ | Alternate Key | **3NF** |
| `skills` | $\text{id} \to \text{name}$; $\text{name} \to \text{id}$ | Candidate Keys | **3NF** |
| `recommendations` | $\text{id} \to \text{attempt\_id, career\_id, rank, similarity\_score}$ | Primary Key | **3NF** |
| `recommendations` | $(\text{attempt\_id}, \text{career\_id}) \to \text{id, rank, similarity\_score}$ | Alternate Key | **3NF** |
| `availability_slots`| $\text{id} \to \text{counsellor\_id, starts\_at, ends\_at, status}$ | Primary Key | **3NF** |
| `bookings` | $\text{id} \to \text{student\_id, counsellor\_id, slot\_id, status, note}$ | Primary Key | **3NF** |

---

## 3. MongoDB Document Modelling & Intentional Denormalization

While PostgreSQL is strictly normalized to 3NF, the MongoDB `guidance_sessions` collection is intentionally designed using document-oriented principles.

### Embedding Decisions & Justification
- **Embedded Messages Array:**
  In `guidance_sessions`, the `messages` array is embedded directly inside the parent session document.
  - **Why not separate `guidance_messages` collection?**
    In conversational AI, messages are never queried in isolation from their session context. Querying a separate collection would require multi-document lookups or secondary indexes on `sessionId`.
  - **Atomicity:**
    Appending a message to a session is achieved via a single atomic `$push` operation, avoiding distributed locking.
  - **Bounded Growth:**
    MargDarshak AI sessions are educational roadmapping dialogs naturally bounded to 10–30 messages. A completed 30-message session occupies less than 15 KB, well within MongoDB's 16 MB BSON document limit.

### Referencing Decisions & Justification
- **Referenced Foreign UUIDs (`studentId`, `attemptId`, `careerIds`):**
  Rather than embedding full student profile documents or career curriculum blueprints into MongoDB, only their PostgreSQL UUID strings are stored.
  - **Prevents Stale Denormalization:** If a student updates their email or a career changes its secondary school requirements, MongoDB records do not require cascading updates.
  - **Decoupled Lifecycle:** Sessions are purged after 180 days via automated retention. Purging chat transcripts leaves the core relational student profile and assessment attempt completely intact.
