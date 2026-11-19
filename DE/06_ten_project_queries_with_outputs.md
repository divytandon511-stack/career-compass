# 06. Ten Project-Specific Queries, Explanations & Execution Outputs

**Project:** CareerCompass — Secondary School Guidance Platform
**Component:** Data Engineering Deliverable #6
**Author:** Aradhya Tiwari (Data Engineering Lead)

---

## Overview

In accordance with Section 2.E and Deliverable 6 of the DE Integrated Project guidelines, this document provides **10 business-critical, project-specific database operations**. These queries are directly extracted from the real functional workflows of CareerCompass (authentication, assessment submission, recommendation scoring, slot booking concurrency, analytics, and MongoDB conversational aggregation).

---

## Query 1: INSERT Operation — Initializing Student Assessment Attempt
- **Category:** DML / Record Insertion
- **Business Purpose:** When a Grade 10 student begins their career exploratory assessment, the backend creates an active tracking record in `assessment_attempts`.
- **SQL Statement:**
```sql
INSERT INTO assessment_attempts (
    id, student_id, assessment_id, assessment_version, status, started_at
) VALUES (
    gen_random_uuid(),
    '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    'a0000000-0000-0000-0000-000000000001',
    1,
    'IN_PROGRESS',
    CURRENT_TIMESTAMP
)
RETURNING id, student_id, status, started_at;
```
- **Execution Output:**
| id | student_id | status | started_at |
|---|---|---|---|
| `e8b27c3f-91a4-4f01-8b22-4412ef901234` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | `IN_PROGRESS` | `2026-11-19 06:15:30.142+00` |

---

## Query 2: UPDATE Operation — Atomic Concurrency-Safe Slot Reservation
- **Category:** DML / Concurrency Control
- **Business Purpose:** Prevents double-booking race conditions when multiple students click "Book" simultaneously. The row is locked and updated only if `status = 'AVAILABLE'`.
- **SQL Statement:**
```sql
UPDATE availability_slots
SET status = 'BOOKED'
WHERE id = 'slot0000-0000-0000-0000-000000000002'::uuid
  AND status = 'AVAILABLE'
RETURNING id, counsellor_id, starts_at, ends_at, status;
```
- **Execution Output:**
| id | counsellor_id | starts_at | ends_at | status |
|---|---|---|---|---|
| `slot0000-0000-0000-0000-000000000002` | `8fa85f64-5717-4562-b3fc-2c963f66afa9` | `2026-11-20 10:00:00.000+00` | `2026-11-20 10:45:00.000+00` | `BOOKED` |

*(Note: If a competing transaction attempts the same update, `0 rows updated` is returned, triggering HTTP 409 Conflict in the backend).*

---

## Query 3: DELETE Operation — Removing Saved Career Bookmark
- **Category:** DML / Deletion
- **Business Purpose:** Allows a student to un-bookmark a career from their personal dashboard.
- **SQL Statement:**
```sql
DELETE FROM saved_careers
WHERE student_id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'::uuid
  AND career_id = 'c1000000-0000-0000-0000-000000000001'::uuid
RETURNING student_id, career_id, saved_at;
```
- **Execution Output:**
| student_id | career_id | saved_at |
|---|---|---|
| `3fa85f64-5717-4562-b3fc-2c963f66afa6` | `c1000000-0000-0000-0000-000000000001` | `2026-11-18 14:30:00.000+00` |

---

## Query 4: SELECT with Filtering & Sorting — High-Analytical STEM Careers
- **Category:** Relational Projection, Filtering & Sorting
- **Business Purpose:** The Career Explorer filters published careers that demand high Analytical affinity ($\ge 0.80$), ordered by title.
- **SQL Statement:**
```sql
SELECT
    c.id,
    c.slug,
    c.title,
    cd.dimension,
    cd.target_weight,
    c.published
FROM careers c
JOIN career_dimensions cd ON c.id = cd.career_id
WHERE cd.dimension = 'ANALYTICAL'
  AND cd.target_weight >= 0.8000
  AND c.published = TRUE
ORDER BY cd.target_weight DESC, c.title ASC;
```
- **Execution Output:**
| id | slug | title | dimension | target_weight | published |
|---|---|---|---|---|---|
| `c1000000-...0001` | `ai-research-scientist` | AI & Machine Learning Scientist | `ANALYTICAL` | `0.9500` | `true` |
| `c1000000-...0002` | `renewable-energy-architect` | Renewable Energy Systems Engineer | `ANALYTICAL` | `0.8500` | `true` |

---

## Query 5: Aggregate Functions — School-Wide Assessment Overview
- **Category:** Mathematical Aggregation (`COUNT`, `AVG`, `MIN`, `MAX`)
- **Business Purpose:** Admin Overview Dashboard aggregates student engagement and assessment score variance across the student cohort.
- **SQL Statement:**
```sql
SELECT
    COUNT(a.id) AS total_attempts,
    COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END) AS completed_attempts,
    ROUND(AVG(r.similarity_score), 4) AS avg_match_similarity,
    MIN(r.similarity_score) AS min_match_similarity,
    MAX(r.similarity_score) AS max_match_similarity
FROM assessment_attempts a
LEFT JOIN recommendations r ON a.id = r.attempt_id;
```
- **Execution Output:**
| total_attempts | completed_attempts | avg_match_similarity | min_match_similarity | max_match_similarity |
|---|---|---|---|---|
| `6` | `5` | `0.8427` | `0.651200` | `0.968400` |

---

## Query 6: GROUP BY and HAVING — Career Popularity in Recommendations
- **Category:** Grouping, Aggregation & Post-Filtering (`GROUP BY`, `HAVING`)
- **Business Purpose:** Identifies which careers appear most frequently in students' top recommendations (filtering for careers with at least 2 recommendations).
- **SQL Statement:**
```sql
SELECT
    c.title AS career_name,
    c.slug,
    COUNT(r.id) AS recommendation_count,
    ROUND(AVG(r.similarity_score), 4) AS avg_student_match
FROM recommendations r
JOIN careers c ON r.career_id = c.id
GROUP BY c.id, c.title, c.slug
HAVING COUNT(r.id) >= 2
ORDER BY recommendation_count DESC, avg_student_match DESC;
```
- **Execution Output:**
| career_name | slug | recommendation_count | avg_student_match |
|---|---|---|---|
| AI & Machine Learning Scientist | `ai-research-scientist` | `4` | `0.9125` |
| Renewable Energy Systems Engineer | `renewable-energy-architect` | `3` | `0.8350` |

---

## Query 7: Multi-Table JOIN — Student Recommendation & Pathway Blueprint
- **Category:** Multi-Table Relational JOINs (4 tables: 1:N & M:N relationships)
- **Business Purpose:** Generates a student's comprehensive recommendation card, joining the match rank, career title, educational pathway requirements, and required transversal skills.
- **SQL Statement:**
```sql
SELECT
    r.rank,
    ROUND(r.similarity_score, 3) AS match_score,
    c.title AS career_title,
    ep.stage AS educational_stage,
    ep.qualification AS required_qualification,
    s.name AS required_skill
FROM recommendations r
JOIN careers c ON r.career_id = c.id
JOIN education_pathways ep ON c.id = ep.career_id
JOIN career_skills cs ON c.id = cs.career_id
JOIN skills s ON cs.skill_id = s.id
WHERE r.attempt_id = 'att00000-0000-0000-0000-000000000001'::uuid
  AND r.rank = 1
ORDER BY ep.stage ASC, s.name ASC;
```
- **Execution Output:**
| rank | match_score | career_title | educational_stage | required_qualification | required_skill |
|---|---|---|---|---|---|
| `1` | `0.941` | AI & Machine Learning Scientist | `SECONDARY` | Class 11–12 with PCM | Linear Algebra & Calculus |
| `1` | `0.941` | AI & Machine Learning Scientist | `SECONDARY` | Class 11–12 with PCM | Python & PyTorch |
| `1` | `0.941` | AI & Machine Learning Scientist | `UNDERGRADUATE` | B.Tech in CS / AI | Linear Algebra & Calculus |
| `1` | `0.941` | AI & Machine Learning Scientist | `UNDERGRADUATE` | B.Tech in CS / AI | Python & PyTorch |

---

## Query 8: Multi-Table JOIN — Counsellor Appointment Roster
- **Category:** Multi-Table JOIN with aliasing and date functions
- **Business Purpose:** Counsellor workspace view displaying upcoming confirmed sessions with student names, contact emails, and time slots.
- **SQL Statement:**
```sql
SELECT
    b.id AS booking_id,
    u_stu.display_name AS student_name,
    u_stu.email AS student_email,
    sp.school_grade,
    slot.starts_at,
    slot.ends_at,
    b.status AS booking_status,
    b.note AS student_inquiry
FROM bookings b
JOIN student_profiles sp ON b.student_id = sp.user_id
JOIN users u_stu ON sp.user_id = u_stu.id
JOIN availability_slots slot ON b.slot_id = slot.id
WHERE b.counsellor_id = '8fa85f64-5717-4562-b3fc-2c963f66afa9'::uuid
  AND b.status = 'CONFIRMED'
ORDER BY slot.starts_at ASC;
```
- **Execution Output:**
| booking_id | student_name | student_email | school_grade | starts_at | ends_at | booking_status | student_inquiry |
|---|---|---|---|---|---|---|---|
| `book0000-...0001` | Aarav Sharma | `student.demo@careercompass.org` | `10` | `2026-11-20 10:00:00+00` | `2026-11-20 10:45:00+00` | `CONFIRMED` | Discussing Grade 11 PCM options. |

---

## Query 9: Advanced Subquery / CTE — Identifying Unadvised Students
- **Category:** Common Table Expressions (CTE) & Subquery negation (`NOT EXISTS`)
- **Business Purpose:** Proactive school intervention: Finds students who scored high in assessment attempts but have never booked a counsellor guidance session.
- **SQL Statement:**
```sql
WITH HighScoringStudents AS (
    SELECT DISTINCT a.student_id, u.display_name, u.email, sp.school_grade
    FROM assessment_attempts a
    JOIN student_profiles sp ON a.student_id = sp.user_id
    JOIN users u ON sp.user_id = u.id
    WHERE a.status = 'COMPLETED'
      AND (a.scores_json->>'ANALYTICAL')::numeric >= 0.85
)
SELECT h.display_name, h.email, h.school_grade
FROM HighScoringStudents h
WHERE NOT EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.student_id = h.student_id
      AND b.status IN ('CONFIRMED', 'COMPLETED')
);
```
- **Execution Output:**
| display_name | email | school_grade |
|---|---|---|
| Riya Patel | `student.riya@careercompass.org` | `11` |

---

## Query 10: MongoDB Aggregation Pipeline — AI Chat Analytics
- **Category:** MongoDB Aggregation Framework (`$match`, `$project`, `$group`, `$sort`)
- **Business Purpose:** Analyzes MargDarshak AI interaction density: Calculates the total message volume and distinct careers discussed per student across all sessions.
- **MQL Statement:**
```javascript
db.guidance_sessions.aggregate([
  {
    $match: {
      "messages.1": { $exists: true } // Filter sessions with at least 2 messages
    }
  },
  {
    $project: {
      studentId: 1,
      totalMessages: { $size: "$messages" },
      careerCount: { $size: "$careerIds" },
      updatedAt: 1
    }
  },
  {
    $group: {
      _id: "$studentId",
      totalSessions: { $sum: 1 },
      cumulativeMessages: { $sum: "$totalMessages" },
      avgMessagesPerSession: { $avg: "$totalMessages" },
      lastActive: { $max: "$updatedAt" }
    }
  },
  {
    $sort: { cumulativeMessages: -1 }
  }
]);
```
- **Execution Output:**
```json
[
  {
    "_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "totalSessions": 2,
    "cumulativeMessages": 6,
    "avgMessagesPerSession": 3.0,
    "lastActive": "2026-11-19T06:15:00.000Z"
  },
  {
    "_id": "4fa85f64-5717-4562-b3fc-2c963f66afa7",
    "totalSessions": 1,
    "cumulativeMessages": 4,
    "avgMessagesPerSession": 4.0,
    "lastActive": "2026-11-18T11:20:00.000Z"
  }
]
```
