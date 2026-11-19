# 01. Database Selection & Architectural Justification

**Project:** CareerCompass — Secondary School Guidance Platform
**Component:** Data Engineering Deliverable #1
**Author:** Aradhya Tiwari (Data Engineering Lead)

---

## 1. Selected Database Architecture: Polyglot Persistence

For CareerCompass, we selected a **hybrid polyglot persistence architecture** combining:
1. **Primary Database:** **PostgreSQL 16** (Relational SQL Database managed via Prisma ORM)
2. **Supplementary Database:** **MongoDB 6+** (Document NoSQL Database managed via Mongoose 8)

Rather than forcing relational data into a document store or forcing semi-structured streaming chat logs into relational tables, each database engine handles the data model it natively excels at.

---

## 2. Requirement-Driven Justification

### A. Why PostgreSQL is the Authoritative Primary Store

| Business Requirement | Technical Need | Why PostgreSQL is Ideal |
|---|---|---|
| **Conflict-Free Counsellor Booking** | Multiple students must not book the same counsellor availability slot simultaneously under peak network traffic. | **Strict ACID Guarantees & Row-Level Locking:** PostgreSQL supports transactional concurrency control (`SELECT ... FOR UPDATE` or atomic conditional updates `UPDATE ... WHERE status = 'AVAILABLE'`) ensuring serialized consistency ($I$ in ACID). |
| **Relational Data Integrity** | A student has multiple assessment attempts; an attempt has multiple question answers; answers generate ranked career recommendations. | **Foreign Key Constraints & Referential Integrity:** Cascade policies (`ON DELETE CASCADE`, `ON DELETE RESTRICT`) ensure orphaned records cannot exist. An attempt cannot reference a non-existent student, and a booking cannot reference an invalid slot. |
| **Deterministic Vector Matching** | Math engine calculates weighted cosine similarity between student dimension scores and curated career profile vectors. | **Strongly Typed Numeric Types & JSONB:** Decimal types (`DECIMAL(7, 6)`) provide zero-precision-loss mathematical representations. JSONB allows indexing and querying multi-dimensional score vectors. |
| **Identity, Security & RBAC** | Student, Counsellor, and Admin roles dictate access to assessment attempts, appointments, and school analytics. | **Role-Based Schema Isolation & Unique Indexes:** Unique constraint on `users.email` prevents duplicate registrations. Password hashes (Argon2id) are strictly protected. |
| **Reliable Asynchronous Outbox** | Transactional email notifications on booking creation. | **Transactional Outbox Pattern:** PostgreSQL allows saving a booking and queuing an email in the `email_outbox` table within the same atomic `$transaction`. |

### B. Why MongoDB is Selected for AI Guidance History

| Business Requirement | Technical Need | Why MongoDB is Ideal |
|---|---|---|
| **MargDarshak AI Chat Conversations** | Multi-turn conversational guidance with varying turn lengths, streaming token metadata, and variable grounding tags. | **Flexible Hierarchical Documents:** MongoDB stores entire chat threads as a single document containing an embedded array of message subdocuments (`messages: [{ role, text, groundingCareerIds, createdAt }]`). |
| **High Read/Write Thread Locality** | A student opening a chat session needs all 10–20 messages in chronological order in one retrieval. | **Embedded Arrays (Single-IO Fetch):** In a relational DB, loading a conversation requires an expensive `JOIN` or sequential scan over thousands of individual message rows. In MongoDB, `findOne({ sessionId })` retrieves the entire thread in a single fast I/O operation. |
| **Zero Impact on Core School Functions** | If external LLM APIs timeout or guidance storage degrades, core features (assessment, roadmaps, counsellor booking) must remain 100% operational. | **Service & Storage Decoupling:** MongoDB operates as an append-only store. If MongoDB is temporarily unreachable, the backend returns a localized `503 DB_UNAVAILABLE` on `/api/v1/guidance` routes, while PostgreSQL continues serving all other endpoints. |
| **Data Retention & Expiry Policies** | Guidance chat sessions must be retained for 180 days per school data privacy guidelines. | **TTL Indexing & Fast Purging:** Document-level TTL indexes or fast range deletion (`deleteMany({ updatedAt: { $lt: cutoff } })`) allow rapid cleanup without table locks. |

---

## 3. Nature of Data Stored Across Databases

```
+-----------------------------------------------------------------------------------+
|                                 CAREERCOMPASS DATA                                |
+-----------------------------------------------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                                                               |
         v                                                               v
+------------------------------------+          +-----------------------------------+
|      POSTGRESQL RELATIONAL STORE   |          |     MONGODB DOCUMENT STORE        |
+------------------------------------+          +-----------------------------------+
| - Highly Structured & Relational   |          | - Semi-Structured & Hierarchical  |
| - Low Tolerance for Inconsistency  |          | - High Write/Append Velocity      |
| - Strict Referential Integrity     |          | - Self-Contained Thread History   |
| - Complex Multi-Table JOINs        |          | - Non-Critical Operational Data   |
|                                    |          |                                   |
| Entities:                          |          | Collections:                      |
| * users, student_profiles          |          | * guidance_sessions               |
| * counsellor_profiles              |          |   - embedded messages[]           |
| * assessments, questions, answers  |          |   - grounding_career_ids[]        |
| * attempts, recommendations        |          +-----------------------------------+
| * careers, skills, career_skills   |
| * education_pathways               |
| * availability_slots, bookings     |
| * email_outbox, refresh_sessions   |
+------------------------------------+
```

---

## 4. Evaluation of Alternative Architectural Choices

### Alternative 1: Pure MongoDB (No Relational Database)
- **Why Rejected:** MongoDB does not enforce declarative foreign keys across collections natively. Managing counsellor availability slots and appointment booking in MongoDB creates severe race condition vulnerabilities during concurrent student requests. Multi-table joins (e.g., joining recommendations to careers, skills, and educational pathways) require complex `$lookup` stages that have lower performance and zero compile-time schema guarantees compared to PostgreSQL and Prisma.

### Alternative 2: Pure PostgreSQL (Storing Guidance Chat as Rows)
- **Why Rejected:** A pure relational design requires a `guidance_messages` table with hundreds of thousands of individual rows. Loading a 30-message conversation requires indexing and joining. Furthermore, frequent conversational writes and variable grounding tags clutter relational WAL logs. Separating guidance history into MongoDB ensures zero lock contention with mission-critical booking and assessment tables.

---

## 5. Summary Conclusion

The hybrid choice satisfies all system functional and non-functional requirements:
- **Consistency:** ACID guarantees for booking and assessment grading in PostgreSQL.
- **Performance:** Single-read document locality for AI conversational guidance in MongoDB.
- **Resilience:** Dual-database isolation ensuring failures in optional AI guidance never compromise the integrity of core school guidance workflows.
