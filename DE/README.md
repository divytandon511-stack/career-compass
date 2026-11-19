# CareerCompass — Data Engineering (DE) Submission Dossier

**Subject:** Data Engineering (DE) Integrated Project
**Project Name:** CareerCompass (Secondary School Career Guidance & Stream Planning Platform)
**Repository Branch:** `main`
**Team Members & Focus Areas:**
- **Divy Tandon** — Applied Mathematics & Backend Architecture Lead
- **Dhavika Bika** — ISD & Frontend Architecture Lead
- **Aradhya Tiwari** — Data Engineering & Entrepreneurship Lead

---

## Executive Summary

CareerCompass is an integrated, school-oriented career guidance platform designed for secondary school students (Grades 9–12) aligned with India's National Education Policy (NEP 2020). The application integrates a psychometric exploratory assessment, deterministic weighted cosine similarity recommendation engine, verified educational roadmap exploration, concurrency-controlled counsellor scheduling, and AI-assisted conversational guidance (MargDarshak AI).

To support these diverse functional requirements with high data integrity and resilience, CareerCompass implements a **Polyglot / Dual-Database Architecture**:
1. **Primary Relational Store (PostgreSQL 16 via Prisma ORM):** Authoritative ACID store managing identity, authentication, RBAC, assessment questions, student attempts, mathematical recommendations, career roadmaps, availability slots, bookings, and audit outbox.
2. **Supplementary Document Store (MongoDB 6+ via Mongoose 8):** Append-only document database managing bounded MargDarshak AI chat transcripts and conversational grounding states.

---

## Mandatory Deliverables Mapping

In strict accordance with the **DE Integrated Project Expectations and Submission Guidelines**, all eight required deliverables are comprehensively documented across this `DE/` directory:

| # | Guideline Deliverable | Primary File | Key Highlights |
|---|---|---|---|
| **1** | **Database Selection & Justification** | [`01_database_selection_and_justification.md`](./01_database_selection_and_justification.md) | Relational vs. Document analysis, ACID requirements, trade-off matrix, polyglot persistence rationale. |
| **2** | **ER Diagram & Data Modelling** | [`02_er_diagram_and_data_modelling.md`](./02_er_diagram_and_data_modelling.md) | Mermaid ER diagram, 14 entities, 1:1, 1:N, M:N relationships, PK/FK definitions, MongoDB document model. |
| **3** | **Database Normalization (3NF)** | [`03_database_normalization_3nf.md`](./03_database_normalization_3nf.md) | Formal normalization journey from UNF $\to$ 1NF $\to$ 2NF $\to$ 3NF, functional dependencies, MongoDB embedding justification. |
| **4** | **Final Database Schema & DDL** | [`04_final_database_schema.sql`](./04_final_database_schema.sql) | Complete PostgreSQL DDL (tables, enums, constraints, foreign keys, unique indexes) & MongoDB schema definitions. |
| **5** | **Sample Records** | [`05_sample_records.sql`](./05_sample_records.sql) | Representative seed records for users, questions, career catalog, attempts, recommendations, and appointments. |
| **6** | **10 Project-Specific Queries & Outputs** | [`06_ten_project_queries_with_outputs.md`](./06_ten_project_queries_with_outputs.md) | 10 business-critical queries (CRUD, JOINs, Group By/Having, Aggregates, Subqueries, Mongo Aggregation) with execution results. |
| **7** | **Database-Backend Integration Evidence** | [`07_database_backend_integration.md`](./07_database_backend_integration.md) | Node.js Express controllers, Prisma repository adapters, atomic transactions, and MongoDB failure isolation. |
| **8** | **Integrity, Indexing & Performance** | [`08_architecture_integrity_and_performance.md`](./08_architecture_integrity_and_performance.md) | Primary/foreign key constraints, B-Tree indexes, partial unique indexing, concurrency control, and scalability strategy. |

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       React 18 Frontend Client        |
                      +---------------------------------------+
                                          |
                                          | HTTPS / REST (/api/v1)
                                          v
                      +---------------------------------------+
                      |       Node.js / Express Backend       |
                      |   (Controllers, Services, Repositories)|
                      +---------------------------------------+
                                  /               \
            Prisma ORM Client    /                 \   Mongoose ODM Client
           (ACID Transactions)  /                   \ (Async Append-Only)
                               v                     v
          +---------------------------+   +---------------------------+
          |      PostgreSQL 16        |   |         MongoDB 6+        |
          |  (Authoritative Store)    |   |    (Guidance Sessions)    |
          |---------------------------|   |---------------------------|
          | - Users & Auth Sessions   |   | - Session Transcripts     |
          | - Student/Counsellor Data |   | - Bounded Chat Messages   |
          | - Assessment & Answers    |   | - Grounding Career Tags   |
          | - Career Recommendation   |   | - Automatic Retention TTL |
          | - Concurrency Slots/Book  |   +---------------------------+
          +---------------------------+
```

---

## How to Review This Folder

- For academic evaluation, start with **`01_database_selection_and_justification.md`** through **`03_database_normalization_3nf.md`** to verify data modelling and 3NF relational purity.
- To inspect SQL implementation and executable queries, refer to **`04_final_database_schema.sql`** and **`06_ten_project_queries_with_outputs.md`**.
- To verify real-world application integration, refer to **`07_database_backend_integration.md`**.
