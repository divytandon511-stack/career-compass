# CareerCompass

> **Problem Statement:** Develop Effective Career Counselling and Guidance Programs in Schools to Enhance Student Career Choices.

**CareerCompass** is an integrated, school-oriented career guidance platform designed for secondary and higher secondary school students (Grades 9–12) in India. The system aligns with the National Education Policy (NEP 2020) framework to help students understand their interest profiles, explore verified educational pathways, and connect with school counsellors for personalized guidance.

---

## 1. Project Overview & Core Philosophy

Choosing an academic stream and career path in secondary school is often clouded by peer pressure, parental expectations, and fragmented, commercially driven advice. CareerCompass provides an accessible, transparent, and structured alternative through:

1. **Self-Reported Interest Profiling:** A 30-question exploratory assessment measuring 6 product-defined interest dimensions (`ANALYTICAL`, `CREATIVE`, `SOCIAL`, `PRACTICAL`, `ORGANIZATIONAL`, `INVESTIGATIVE`).
2. **Transparent, Deterministic Recommendations:** A mathematical weighted cosine-similarity engine matching student interest vectors against human-curated career vectors. Recommendations are deterministic, explainable, and never presented as psychometric certification or placement guarantees.
3. **Verified Career Pathways:** Educational roadmaps (secondary school requirements, undergraduate/postgraduate degrees, entrance examinations such as JEE, NEET, CUET, CLAT) curated and verified from official government and educational sources.
4. **Conflict-Free Counsellor Booking:** An appointment scheduling system with database-enforced concurrency control to eliminate double-booking while preserving full cancellation and audit history.
5. **AI Guidance Assistant (MargDarshak AI):** An explanatory conversational companion that contextualizes recommendations using verified catalogue data and student dimension scores. **MargDarshak AI never calculates, modifies, or overrides mathematical recommendation scores.**
6. **Privacy-Preserving School Analytics:** Administrative dashboards with $k$-anonymity suppression ($k \ge 5$) providing aggregate interest trends without exposing individual student records.

---

## 2. Target Users & Capabilities

| User Role | Target Audience | Core Platform Capabilities |
|---|---|---|
| `STUDENT` | Secondary & higher secondary students (Grades 9–12) | Take interest assessment, view radar chart profile, explore ranked career matches, bookmark careers, converse with MargDarshak AI, book counsellor appointments. |
| `COUNSELLOR` | School counsellors & designated academic advisors | Publish availability slots, manage upcoming appointments, review student interest context (with consent), mark sessions completed or cancelled. |
| `ADMIN` | School principals, guidance coordinators | Manage career catalogue and question bank, monitor user accounts, view aggregate school interest trends and slot utilization with privacy suppression. |

---

## 3. Planned Technology Stack

| Layer | Technology | Architectural Role |
|---|---|---|
| **Frontend Client** | React 18, Vite, React Router 6 | Responsive, accessible web application (WCAG 2.1 AA), canvas-driven radar charts, in-memory token state. Zero direct database connections. |
| **Backend API** | Node.js, Express | Versioned RESTful API (`/api/v1`), Zod validation, layered architecture (route → middleware → controller → service → repository). |
| **Relational Database** | PostgreSQL 15+ | **Authoritative source of truth** for users, credentials, career catalogue, assessment definitions, finalized scores, availability slots, bookings, and email outbox. |
| **Relational ORM** | Prisma ORM | Type-safe database queries, declarative migrations, and reproducible synthetic seed scripts. |
| **Document Database** | MongoDB 6+ & Mongoose | **Supplementary append-only storage** for bounded AI guidance conversation histories and diagnostic assessment event logs. |
| **Recommendation Engine** | Custom Mathematical Service | Deterministic weighted cosine-similarity vector matching executed in PostgreSQL/backend service layer. |
| **Authentication** | Argon2id / bcrypt, JWT | Short-lived access JWTs in memory, rotated refresh tokens in `HttpOnly`/`Secure` cookies, token family revocation. |
| **AI Integration** | External LLM Provider (via backend proxy) | Grounded natural language explanations; sandboxed prompt pipeline with complete PII redaction and non-blocking failure degradation. |
| **Notifications** | Transactional Email Adapter | Asynchronous outbox worker pattern with retries and idempotency keys. |

---

## 4. Team Ownership & Responsibilities

CareerCompass is developed by a three-member capstone engineering team:

| Team Member | Capstone Focus & Role | Primary Responsibilities |
|---|---|---|
| **Divy Tandon** | Applied Mathematics & Backend Architecture (Lead) | System architecture, versioned REST API contract, authentication lifecycle & RBAC, mathematical recommendation algorithm (weighted cosine similarity), backend security, analytics endpoints, automated test suites. |
| **Dhavika Bika** | ISD & Frontend Architecture (Lead) | React/Vite client architecture, UI/UX specification & design system tokens, accessible student/counsellor/admin user journeys, interactive assessment runner, radar chart visualization, MargDarshak AI guidance interface. |
| **Aradhya Tiwari** | Data Engineering & Entrepreneurship (Lead) | PostgreSQL relational data modeling & DDL, Prisma ORM schema & migrations, MongoDB document models & aggregations, curated career catalogue & educational pathways, booking concurrency architecture, business case & feasibility analysis. |

---

## 5. Repository Structure

```text
career-compass/
├── .gitignore                      # Git ignore rules for Node, Vite, env files, caches
├── README.md                       # Master project overview, architecture, and roadmap
├── backend/                        # Backend application source code (implementation pending)
│   └── .gitkeep
├── database/                       # Database DDL, migration scripts, and seed data (pending)
│   └── .gitkeep
├── frontend/                       # Frontend React/Vite application source code (pending)
│   └── .gitkeep
└── docs/                           # Authoritative system documentation & specifications
    ├── architecture.md             # System architecture, layered design, tech decisions
    ├── api-contract.md             # REST API specification (/api/v1), payloads, error codes
    ├── ui-specification.md         # Frontend UI/UX design, user journeys, design system
    ├── ai-guidance-design.md       # MargDarshak AI architecture, prompt grounding, safety
    ├── data-model.md               # PostgreSQL schema, Prisma models, MongoDB collections
    ├── er-diagram.md               # Mermaid ER diagrams, cardinalities, concurrency design
    ├── business-case.md            # Problem validation, feasibility, sustainability, metrics
    ├── business-plan.md            # Data Engineering & Entrepreneurship domain scope
    └── isd-plan.md                 # ISD & Frontend domain scope
```

---

## 6. System Documentation Index

System documentation and architectural specifications have been reviewed and reconciled in the `docs/` directory, subject to the unresolved mentor and team decisions detailed in §10:

- [System Architecture](docs/architecture.md) — Architectural principles, layered module boundaries, security model, and rubric traceability.
- [REST API Contract](docs/api-contract.md) — Endpoint specifications for `/api/v1`, request/response envelopes, error semantics, and status codes.
- [UI/UX Specification](docs/ui-specification.md) — Complete user journeys, component hierarchy, design system tokens, WCAG 2.1 AA accessibility, and ISD rubric mapping.
- [AI Guidance System Design](docs/ai-guidance-design.md) — MargDarshak AI prompt sandboxing, strict catalog grounding, PII redaction, and dual-database resilience.
- [Data Model Specification](docs/data-model.md) — PostgreSQL table definitions, Prisma ORM models, partial unique indexes, MongoDB schemas, and sample queries.
- [Entity-Relationship Diagram](docs/er-diagram.md) — Mermaid ER diagrams, table cardinalities, and booking concurrency mechanics.
- [Business Case & Feasibility](docs/business-case.md) — Stakeholder analysis, implementation feasibility, operational metrics, and ethical boundaries.
- [Business & Data Plan](docs/business-plan.md) — Entrepreneurship and data engineering domain responsibilities.
- [ISD & Frontend Plan](docs/isd-plan.md) — Interface system design and frontend application responsibilities.

---

## 7. Current Project Status

- **Status:** **Documentation and System Integration Review Completed (Design Stage).**
- **Application Code Status:** Implementation has **not yet started**. Directories `frontend/`, `backend/`, and `database/` currently contain `.gitkeep` placeholders.
- **Integrity Note:** No mock application code, artificial test runs, or fabricated deployment URLs are included. Specifications have been reviewed and cross-reconciled, but remain subject to unresolved mentor and team decisions (see §10) before code implementation begins.

---

## 8. High-Level Development Roadmap

```text
Phase 1: Architecture & Integration Review (Completed)
 └── Reconcile cross-document contracts (API, Data Model, UI, AI design, Concurrency).

Phase 2: Database Layer & Data Seeding
 ├── Initialize Prisma schema and generate initial PostgreSQL migrations.
 ├── Seed database with 10–15 curated MVP career profiles, pathways, and 30-question assessment bank.
 └── Set up Mongoose connection for supplementary MongoDB collections.

Phase 3: Core Backend API Implementation
 ├── Implement Express application shell with security middleware (Helmet, CORS, rate-limiting).
 ├── Auth module: Argon2id hashing, JWT access/refresh token rotation, RBAC guards.
 ├── Assessment & Mathematical Recommendation module: Weighted cosine-similarity scoring.
 ├── Booking module: Concurrency-safe slot reservation with partial unique index protection.
 └── Analytics module: Aggregate reporting with k-anonymity suppression (k >= 5).

Phase 4: Frontend Application Development
 ├── Initialize React 18 + Vite project structure, routing, and design system tokens.
 ├── Build accessible questionnaire runner with local state caching.
 ├── Implement Canvas-based 6-axis Radar Chart for dimension profiles.
 ├── Develop Career Explorer directory, filters, and detailed educational pathway blueprints.
 └── Build Counsellor scheduling and booking management interfaces.

Phase 5: MargDarshak AI Integration
 ├── Implement sandboxed backend LLM proxy with PII redaction and context delimiters.
 ├── Integrate MongoDB guidance session persistence and bounded history management.
 └── Implement graceful UI degradation on AI provider timeouts or outages.

Phase 6: Verification, Testing & Capstone Review
 ├── Execute automated unit and integration tests (scoring, auth, booking races).
 ├── Conduct end-to-end user journey audits against college evaluation rubrics.
 └── Prepare final demonstration with synthetic datasets.
```

---

## 9. Prerequisites & Verification

The following tools and runtime environments are planned for local development:

- **Node.js:** v18.x or v20.x LTS
- **Package Manager:** `npm` (v9+)
- **Relational Database:** PostgreSQL 15+
- **Document Database:** MongoDB 6+
- **Version Control:** Git

### Existing Repository Verification

To inspect the documentation and verify the current repository state:

```bash
# Clone the repository
git clone https://github.com/divytandon511-stack/career-compass.git
cd career-compass

# Verify the working branch
git branch --show-current
# Expected output: main

# Inspect documentation files
ls -la docs/
```

*(Note: Application build commands such as `npm install` or `npm run dev` will be configured during Phase 2 and Phase 3 once project manifests `package.json` are initialized).*

---

## 10. Known Unresolved Decisions (Pending Team/Mentor Approval)

The following design decisions are documented across the architectural specifications and require formal team or academic mentor confirmation prior to implementation:

1. **Multi-School Tenancy Scope:** Whether the MVP is constrained to a single school/demo cohort or requires multi-tenant `schoolId` scoping across all database tables and queries.
2. **Student Age & Guardian Consent:** Clarification on school data governance policies regarding parental/guardian consent workflows for minors under 18 years of age.
3. **College ISD Delivery Track:** Confirmation from the college mentor on whether a responsive React web client fully satisfies the integrated ISD component, or if a separate offline deliverable is required.
4. **Third-Party Service Providers:** Selection and budget allocation for the external LLM provider (e.g., OpenAI, Google Gemini) and transactional email service.
5. **Slot Cancellation Cutoff Policy:** Confirmation on whether a time-based cutoff policy (e.g., cancellation allowed up to 2 hours before the slot) is required for the MVP, or if immediate cancellation remains active for demo simplicity.
