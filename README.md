# CareerCompass

> Secondary school career guidance and stream planning platform aligned with the NEP 2020 framework.

CareerCompass empowers secondary and higher secondary school students (Grades 9–12) to make transparent, interest-aligned educational choices. By replacing fragmented, high-pressure advice with self-reported interest profiling, deterministic vector recommendations, structured educational pathways, concurrency-controlled counsellor scheduling, and AI-assisted conversational guidance, CareerCompass bridges the gap between classroom interests and real-world career trajectories.

---

## Overview

Secondary school students face critical educational milestones when selecting subject streams in Grade 11 and navigating entrance examinations for higher education. CareerCompass provides an integrated, transparent digital platform designed for secondary schools:

- **For Students:** Discover personal interest dimensions across analytical, creative, social, practical, organizational, and investigative disciplines; explore curated career pathways; converse with an AI guidance advisor; and schedule one-on-one sessions with school counsellors.
- **For Counsellors:** Manage availability slots, review student assessment profiles with student consent, prevent scheduling conflicts, and track student guidance sessions.
- **For Administrators:** Monitor aggregate school-wide interest distributions across dimensions, maintain the curated career catalog, and manage institutional counsellor accounts.

---

## Key Features

### 1. Student Interest Assessment
- **30-Question Exploratory Instrument:** Seeded questionnaire measuring self-reported student affinity across 6 canonical interest dimensions (`ANALYTICAL`, `CREATIVE`, `SOCIAL`, `PRACTICAL`, `ORGANIZATIONAL`, `INVESTIGATIVE`) with 5 questions per dimension.
- **Interactive Visual Feedback:** Visualizes dimensional scores on an interactive, canvas-driven 6-axis Radar Chart with clear score breakdowns.
- **Progress Preservation & Resumption:** Individual answers are saved to the database as they are submitted, allowing authenticated students to resume active in-progress assessment attempts across sessions.

### 2. Deterministic Career Matching Engine
- **Mathematical Vector Alignment:** Computes career rankings using weighted cosine similarity between student dimension scores and curated career profile vectors.
- **Transparent & Non-Certified:** Recommendations explain exact dimension alignments and explicitly avoid high-stakes certification or placement guarantees.

### 3. Career Explorer & Educational Roadmaps
- **Curated Career Catalog:** Browse curated careers with transversal skill tags, industry overviews, and salary insights.
- **Structured Educational Roadmaps:** Step-by-step blueprints covering Grade 11–12 stream combinations, undergraduate/postgraduate degrees, and national entrance exams (e.g., JEE, NEET, CUET, CLAT).
- **Bookmarking & Saved Careers:** Save target careers to track personal exploration directly from the student dashboard.

### 4. MargDarshak AI Guidance Companion
- **Contextually Grounded Guidance:** Explains educational pathways and secondary subject streams grounded in the student's assessment scores and the curated career catalog.
- **Prompt Isolation:** Uses structured XML delimiters (`<verified_context>`, `<student_query>`) to separate trusted backend context from untrusted user input, accompanied by uncertainty disclaimers.
- **Graceful Fault Tolerance:** Built on an OpenAI-compatible interface with non-blocking graceful degradation if external LLM providers or MongoDB history storage are unavailable.

### 5. Concurrency-Safe Counsellor Booking
- **Atomic Concurrency Control:** Prevents double-booking via atomic conditional status updates (`UPDATE ... WHERE status = 'AVAILABLE'`) executed within interactive database transactions.
- **Student & Counsellor Management:** Students can book and cancel sessions; counsellors publish recurring availability slots and manage upcoming appointments.

### 6. Student Dashboard & School Analytics
- **Personal Student Hub:** Tracks assessment history, top recommendations, bookmarked careers, and upcoming counsellor appointments.
- **Admin Analytics:** Aggregates school-wide interest distributions across canonical dimensions, completed assessment counts, and booking statistics without exposing individual student assessment answer histories.

---

## Technology Stack

### Frontend Client
- **Framework & Build:** React 18, Vite 5, TypeScript 5
- **Routing:** React Router 6 (`react-router-dom`)
- **State & Networking:** Context API, Custom Hooks, Native Fetch wrapper with automated JWT silent refresh interceptors
- **Visualizations & UI:** HTML5 Canvas (Radar Chart), Modern CSS Custom Properties (Design System tokens), accessible focus states
- **Testing:** Vitest, React Testing Library, JSDOM

### Backend API
- **Runtime & Server:** Node.js (>=22.12.0), Express 4
- **Architecture:** Layered RESTful API (`/api/v1`) with Zod request validation
- **Authentication & Security:** Argon2id password hashing, JWT authentication (short-lived access tokens and rotated refresh tokens in `HttpOnly`/`SameSite` cookies), Helmet, CORS, and Express Rate Limit
- **Testing:** Vitest, Supertest

### Databases & Storage
- **Primary Relational Database:** PostgreSQL 16 (Authoritative store for users, profiles, assessments, recommendations, slots, and bookings)
- **ORM & Migrations:** Prisma ORM 6 (Type-safe client, declarative migrations, and reproducible seeds)
- **Document Store (Supplementary):** MongoDB 6+ & Mongoose 8 (Append-only storage for bounded MargDarshak AI conversation transcripts)

---

## Project Structure

```text
career-compass/
├── backend/
│   ├── prisma/
│   │   ├── migrations/            # Declarative PostgreSQL migrations
│   │   ├── seed-data/             # Curated career catalog & question bank
│   │   └── schema.prisma          # Prisma schema definition
│   ├── src/
│   │   ├── assessment/            # Assessment scoring and dimension math
│   │   ├── config/                # Environment configuration and validation
│   │   ├── controllers/           # HTTP request handlers
│   │   ├── integrations/          # External LLM provider client (MargDarshak AI)
│   │   ├── matching/              # Weighted cosine similarity matching engine
│   │   ├── middleware/            # Auth, RBAC, error handling, and rate limiting
│   │   ├── repositories/          # Prisma and MongoDB data access layers
│   │   ├── routes/                # Versioned REST API route definitions (/api/v1)
│   │   ├── services/              # Business logic and coordination layer
│   │   └── server.js              # HTTP server entrypoint
│   └── tests/                     # Backend automated unit and integration tests
├── frontend/
│   ├── src/
│   │   ├── app/                   # Root application shell and route configuration
│   │   ├── components/            # Reusable UI components (Shared, Auth, Student, Layout)
│   │   ├── context/               # Global state (Authentication, Theme)
│   │   ├── hooks/                 # Reusable React hooks
│   │   ├── pages/                 # Route views (Auth, Student, Counsellor, Admin)
│   │   ├── services/api/          # Strongly-typed API client services
│   │   ├── styles/                # CSS design tokens and base styles
│   │   └── test/                  # Frontend test suites (Component, Integration, Routing)
│   ├── index.html                 # Single-Page Application HTML entrypoint
│   └── vite.config.ts             # Vite build and test configuration
├── docs/                          # Detailed architecture, API, and system specifications
└── docker-compose.yml             # Local PostgreSQL container service
```

---

## Getting Started

### Prerequisites
- **Node.js:** `>=22.12.0` (matching `backend/package.json` engine requirements)
- **Package Manager:** `npm` (v9+)
- **Docker & Docker Compose:** For running the local PostgreSQL container
- **MongoDB (Optional):** Local or cloud MongoDB instance for MargDarshak AI session history (the application automatically degrades gracefully if omitted)

### 1. Clone the Repository
```bash
git clone https://github.com/divytandon511-stack/career-compass.git
cd career-compass
```

### 2. Start PostgreSQL Container

The root `docker-compose.yml` binds PostgreSQL to `localhost:5433` by default (local environment overrides may adjust the host port mapping). It requires `POSTGRES_PASSWORD` to be set in your environment before starting the container:

```bash
# Set your chosen local PostgreSQL password in your shell session
export POSTGRES_PASSWORD=your_secure_dev_password

# Start PostgreSQL 16 container in the background (default port 5433)
docker compose up -d
```
*Note: Ensure the password and host port match the credentials configured in `DATABASE_URL` in `backend/.env`.*

### 3. Setup and Run the Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env to set your JWT_SECRET and match your DATABASE_URL credentials

# Apply database migrations
npx prisma migrate dev

# Seed assessment question bank and career catalog
npm run seed

# Start development server
npm run dev
```
The backend API will be available at `http://localhost:4000/api/v1`.

### 4. Setup and Run the Frontend

Open a new terminal window at the repository root:

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Default VITE_API_URL is http://localhost:4000/api/v1

# Start Vite development server
npm run dev
```
The frontend application will be accessible at `http://localhost:5173`.

### 5. Running Tests

Both backend and frontend contain comprehensive automated test suites. The commands below can be run sequentially from the project root:

```bash
# Run backend tests (434 tests)
(cd backend && npm test)

# Run frontend tests (97 tests)
(cd frontend && npm test)

# Run frontend TypeScript typecheck
(cd frontend && npm run typecheck)

# Build frontend for production
(cd frontend && npm run build)
```

---

## Team

CareerCompass was designed and developed by:

- **Divy Tandon** — Applied Mathematics & Backend Architecture Lead
- **Dhavika Bika** — ISD & Frontend Architecture Lead
- **Aradhya Tiwari** — Data Engineering & Entrepreneurship Lead
