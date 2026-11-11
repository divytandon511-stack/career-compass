# CareerCompass — Business Case

**Status:** Proposed analysis, not implemented  
**Version:** 1.0 · 11 November 2026  
**Document Owner:** Aradhya Tiwari (Entrepreneurship & Data Engineering Lead)  
**Problem Statement:** Develop Effective Career Counselling and Guidance Programs in Schools to Enhance Student Career Choices

---

## 1. Problem Statement

School students in India, particularly those in Grades 9–12, face a critical decision point: choosing academic streams, entrance examinations, and career paths that shape their professional lives. However, structured career guidance in most schools is either absent, limited to one-time career fairs, or dependent on informal advice from family and peers who may lack exposure to the full breadth of career options.

**Observable problems (based on general domain understanding, not verified statistics):**

- Students frequently make stream choices (Science / Commerce / Humanities) based on peer pressure, parental expectations, or perceived prestige rather than alignment with personal interests and strengths.
- Schools often lack dedicated career counsellors or structured guidance programs. Where counsellors exist, the student-to-counsellor ratio is typically very high, limiting individual attention.
- Career information is fragmented across websites, coaching centre advertisements, and word-of-mouth — much of it unverified or commercially motivated.
- Students from smaller towns and rural schools may have even less access to career guidance resources compared to urban peers.
- The National Education Policy (NEP) 2020 envisions student-centric, flexible education with career exposure starting from secondary school, but structured implementation tools remain limited.

**What CareerCompass does NOT claim:**
- We do not claim to be a psychometric assessment tool or a psychological diagnostic instrument.
- We do not claim validated statistics on the scale of the problem.
- We do not claim government endorsement or official adoption.
- We do not guarantee career placement outcomes.

---

## 2. Target Users

| User Type | Description | Key Needs |
|---|---|---|
| **Students (Grades 9–12)** | Secondary and higher secondary school students exploring career directions | Understand personal interests; discover careers aligned with those interests; access verified educational pathway information; speak with a counsellor |
| **School Counsellors** | Trained or designated staff who guide students on academic and career decisions | Manage appointment availability; view student interest profiles (with consent) for contextual guidance; reduce administrative overhead of scheduling |
| **School Administrators** | Principals, vice-principals, or career guidance coordinators | View aggregate trends (e.g., popular interest dimensions, booking utilization); manage career catalogue and user accounts; ensure platform operates within school policies |

### User Personas (Illustrative)

**Persona 1 — Priya, Grade 10 Student**
Priya enjoys mathematics and logical puzzles but is unsure whether to choose Science or Commerce in Grade 11. Her parents want her to pursue engineering, but she is also interested in data analytics and economics. She needs a tool that helps her understand her interests without prescribing a single "correct" answer.

**Persona 2 — Mr. Sharma, School Counsellor**
Mr. Sharma is the sole career counsellor for 400+ students across Grades 9–12. He cannot meet every student individually. He needs a system where students can self-explore their interests, receive initial guidance, and then book appointments with him for deeper discussion — so his limited time is spent on meaningful conversations rather than basic information delivery.

**Persona 3 — Dr. Mehta, School Principal (Admin)**
Dr. Mehta wants to understand aggregate career interest trends across the school to plan career fairs, invite relevant industry speakers, and report to the school board on the effectiveness of their guidance program. She needs privacy-preserving analytics that do not expose individual student data.

---

## 3. Stakeholders

| Stakeholder | Interest | Influence |
|---|---|---|
| **Students** | Direct beneficiaries; need accessible, unbiased, and supportive guidance | Primary users; system must be designed for their comprehension level and safety |
| **Parents / Guardians** | Want best outcomes for their children; may have concerns about data privacy, screen time, and AI influence on decisions | Consent providers (especially for minors); adoption requires parental trust |
| **School Counsellors** | Professional users who integrate the tool into their practice | Power users; if the tool does not save time or adds administrative burden, adoption fails |
| **School Administration** | Decision-makers for platform adoption; responsible for policy compliance | Gatekeepers; approve budget, data policies, and deployment |
| **Teachers** | May recommend the platform to students; may use aggregate insights for mentoring | Secondary influencers; low direct interaction with the platform |
| **Education Policy Bodies (NEP 2020 framework)** | Set guidelines for career guidance in schools | Indirect; platform should align with NEP goals but does not claim official endorsement |

---

## 4. Value Proposition

### 4.1 For Students
- **Self-discovery without pressure:** Students explore their interest profiles through a structured, non-judgmental assessment that reveals dimensions like Analytical, Creative, Social, Practical, Organizational, and Investigative interests.
- **Career exploration grounded in verified data:** The career catalogue provides curated educational pathways (entrance exams, qualifications, stages) reviewed by the data team, not auto-generated content.
- **AI-powered explanations (not predictions):** The MargDarshak AI assistant explains *why* certain careers align with a student's interests, using verified facts, without making promises about future success.
- **Direct access to counsellor appointments:** Students can browse counsellor availability and book sessions without navigating manual scheduling processes.

### 4.2 For Counsellors
- **Time efficiency:** Students arrive at counselling sessions having already explored their interests and specific careers, enabling deeper, more productive conversations.
- **Structured availability management:** Counsellors set their own time slots; the system handles scheduling conflicts and sends notifications.
- **Interest context for sessions:** Counsellors can view (with consent) a student's interest profile to prepare for a session.

### 4.3 For Schools
- **Structured guidance program:** CareerCompass provides a concrete, measurable career guidance offering that schools can point to in their educational programs.
- **Privacy-preserving analytics:** Aggregate dashboards (with k-anonymity suppression) show interest trends and booking utilization without exposing individual student data.
- **Alignment with NEP 2020 vision:** Supports the policy goal of introducing career awareness and flexibility from the secondary school level.

---

## 5. Implementation Feasibility

### 5.1 Technical Feasibility

| Component | Assessment | Risk |
|---|---|---|
| **PostgreSQL + Prisma** | Mature, well-documented stack for relational data. Prisma provides type-safe ORM with migration tooling. | Low — established technology |
| **MongoDB + Mongoose** | Suitable for flexible document storage (AI conversations). Well-supported in Node.js ecosystem. | Low — but cross-database consistency requires careful application-layer handling |
| **Node.js + Express** | Standard backend framework with large community and middleware ecosystem. | Low |
| **React + Vite** | Modern frontend framework with fast development iteration. | Low |
| **JWT Authentication** | Standard token-based auth with refresh rotation. Implementation complexity is moderate but well-documented. | Medium — secure implementation requires careful attention to token storage, rotation, and revocation |
| **External LLM Integration** | Dependency on third-party AI provider. Latency, cost, and availability are external factors. | Medium — mitigated by designing AI as optional (core recommendations work without it) |
| **Email Notifications** | Asynchronous outbox pattern with retries. Requires a transactional email provider. | Low — well-understood pattern |

### 5.2 Team Feasibility

| Team Member | Role | Scope |
|---|---|---|
| **Divy** | Applied Mathematics, Backend Architecture | REST APIs, authentication, recommendation algorithm (cosine similarity), analytics, backend testing |
| **Dhavika** | ISD, Frontend | React UI/UX, student/counsellor/admin interfaces, AI guidance integration, accessibility |
| **Aradhya** | Entrepreneurship, Data Engineering | PostgreSQL/MongoDB modelling, career catalogue, booking domain, seed data, business feasibility |

The three-person team covers backend, frontend, and data layers with clear ownership boundaries. Integration surfaces (API contract, data model, UI specification) are documented as shared contracts.

### 5.3 Resource Requirements

| Resource | Requirement | Notes |
|---|---|---|
| **Development environment** | Node.js 18+, PostgreSQL 15+, MongoDB 6+, npm/yarn | Standard development setup |
| **Hosting (demo/MVP)** | Single server or free-tier cloud services | Sufficient for capstone demonstration |
| **LLM API access** | API key for one supported provider | Cost depends on usage volume; MVP can use rate-limited free tier or university-provided credits |
| **Email service** | Transactional email API (e.g., Resend, Mailgun, or SMTP) | Free tiers typically sufficient for demo |
| **Domain/SSL** | Optional for demo; required for production | Not needed for local/university evaluation |

---

## 6. School Adoption Considerations

### 6.1 Adoption Barriers

| Barrier | Description | Mitigation |
|---|---|---|
| **Trust in AI** | Schools and parents may distrust AI-generated career advice for minors | CareerCompass explicitly labels AI content as supplementary explanation, not authoritative advice. Core recommendations use a transparent mathematical similarity measure. Every AI response carries an "AI-Generated Guidance" disclaimer. |
| **Data privacy concerns** | Schools are custodians of student data; any platform handling student information must comply with school data policies | Synthetic data for demo. Consent mechanisms built in. No real student PII stored in AI prompts. k-anonymity suppression in analytics. Clear data retention and deletion policies. |
| **Infrastructure limitations** | Some schools may lack reliable internet or modern devices | MVP is a web application requiring a modern browser. Offline capability is out of scope for MVP but could be considered later. |
| **Counsellor buy-in** | If counsellors perceive the tool as adding work rather than reducing it, adoption stalls | Designed to complement, not replace, counsellors. Booking system reduces scheduling overhead. Student pre-exploration means more productive sessions. |
| **Cost** | Schools operate on tight budgets | MVP uses free/open-source technology. Cloud hosting costs can be minimal for a single-school deployment. |

### 6.2 Adoption Strategy (Proposed)

1. **Pilot with one school or one grade cohort** (e.g., Grade 10 students choosing streams).
2. **Use synthetic data and demo accounts** for initial deployment and evaluation.
3. **Collect teacher and counsellor feedback** before expanding to more grades or schools.
4. **Demonstrate measurable value** through aggregate analytics (e.g., assessment completion rates, booking utilization).
5. **Iterate on career catalogue** based on school-specific needs and regional entrance exams.

---

## 7. Privacy and Consent

### 7.1 Privacy Principles

1. **Data minimization:** Collect only what is necessary. Student profiles require email, display name, and optional school grade. No phone numbers, addresses, or government IDs.
2. **Purpose limitation:** Assessment data is used for interest profiling and career recommendation. Booking data is used for appointment management. AI guidance data is used for conversational explanation.
3. **Consent:** Registration requires explicit consent acceptance. The specific consent requirements (guardian consent for minors, school policy alignment) must be confirmed with the school/mentor before deployment.
4. **PII redaction in AI:** Student names, emails, and raw assessment answers are never sent to external LLM providers. Only aggregated dimension scores, grade level, and verified career facts are included in prompts.
5. **Right to erasure:** Students can delete their guidance sessions. Account deletion policies must be defined with school input.
6. **k-anonymity in analytics:** Aggregate metrics suppress groups smaller than k=5 to prevent individual identification.

### 7.2 Consent Requirements (Pending Resolution)

> [!WARNING]
> The following consent and privacy items require mentor/school approval before deployment with real students. They are documented as design intentions, not implemented policies.

| Item | Status | Notes |
|---|---|---|
| Guardian consent for minors (< 18) | **Pending** | NEP 2020 and school data policies may require explicit parental consent. Form and process to be defined. |
| School data processing agreement | **Pending** | If school data is processed, a formal agreement between the platform and the school may be required. |
| Data retention period | **Proposed 180 days** for AI guidance; **indefinite** for assessment results (needed for historical analysis). Final policy requires school input. |
| Data hosting location | **Pending** | If deployed beyond demo, data residency requirements may apply. |
| Right to account deletion | **Designed** | Technical capability exists (CASCADE deletes); policy and process require definition. |

---

## 8. Sustainability

### 8.1 Short-Term (Capstone Project)

For the capstone demonstration period:
- The platform runs on development machines or free-tier cloud infrastructure.
- Synthetic seed data populates the career catalogue (10–15 careers) and user accounts.
- The LLM integration uses rate-limited API access.
- No real student data is processed.

### 8.2 Medium-Term (Potential Post-Capstone Continuation)

If the project were continued beyond the capstone:

| Dimension | Approach |
|---|---|
| **Technical maintenance** | Prisma migrations handle schema evolution. Containerization (Docker) enables reproducible deployment. |
| **Career catalogue growth** | The admin interface supports adding careers, skills, and pathways. Catalogue curation requires human review — not automated scraping. |
| **Multi-school scaling** | Architecture §13 identifies `schoolId` tenancy as a pending decision. Adding school-scoped data isolation would enable multi-school deployment. |
| **Cost management** | Primary costs are hosting (PostgreSQL, MongoDB, Node.js server) and LLM API usage. For small-scale school use, free tiers may suffice. |
| **Content verification** | Career pathways (entrance exams, qualifications) require periodic review as education policies change. The `verified_at` field in `EducationPathway` tracks when data was last verified. |

### 8.3 What We Are Not Claiming

- We are not claiming a revenue model or commercial viability at this stage.
- We are not claiming that the MVP is production-ready for deployment in live school environments without further privacy review, consent workflows, and security hardening.
- We are not claiming that the career catalogue is comprehensive or nationally representative. The seed data covers a small sample of careers for demonstration purposes.

---

## 9. Measurable Outcomes

The following outcomes can be measured within the MVP scope. These are **platform operational and engagement metrics**, not speculative claims of lifelong career success.

### 9.1 Core Engagement & Assessment Metrics

| Metric | Precise Measurement Formula | Operational Insight |
|---|---|---|
| **Assessment Completion Rate** | $\frac{\text{COUNT}(\text{attempts WHERE status = 'COMPLETED'})}{\text{COUNT}(\text{attempts})}$ | Measures student drop-off vs completion across the questionnaire wizard. |
| **Career Exploration Breadth** | $\text{COUNT}(\text{DISTINCT } \text{career\_id}) \text{ FROM saved\_careers GROUP BY } \text{student\_id}$ | Evaluates whether students bookmark multiple pathways or focus narrowly on one domain. |
| **Career Save Diversity** | $\text{COUNT}(\text{DISTINCT } \text{career\_id}) \text{ across all saved\_careers}$ | Measures whether student interest spans diverse catalogue clusters or concentrates on a few popular roles. |
| **Repeat Assessment Rate** | $\frac{\text{COUNT}(\text{students with } \ge 2 \text{ completed attempts})}{\text{COUNT}(\text{students with } \ge 1 \text{ completed attempt})}$ | Indicates whether students revisit the assessment as their academic interests evolve. |
| **AI Guidance Engagement** | Aggregate distribution: $\frac{\text{Total messages}}{\text{Total sessions}}$ and $\frac{\text{Sessions}}{\text{Student}}$ | Evaluates student reliance on AI explanations and whether discussions remain within bounded context limits. |

### 9.2 Counsellor & Booking Domain Metrics

To maintain analytical rigor, booking metrics require **precise numerators, denominators, and transparent treatment of cancellations**:

| Metric | Precise Mathematical Formula | Denominator Definition & Cancellation Treatment |
|---|---|---|
| **Slot Capacity Utilization Rate** | $\frac{\text{COUNT}(\text{DISTINCT } s.\text{id WHERE } b.\text{status} \in \{\text{'CONFIRMED'},\text{'COMPLETED'}\})}{\text{COUNT}(\text{DISTINCT } s.\text{id WHERE } s.\text{status} \ne \text{'CANCELLED'})}$ | **Window:** Slots with $s.\text{starts\_at} \in [\text{from}, \text{to}]$.<br>**Numerator:** Distinct slots with an active or fulfilled booking.<br>**Denominator:** Total valid appointment slots offered by counsellors in the date window (slots retracted/cancelled by counsellors are excluded).<br>**Rebooking rule:** If a slot was booked, cancelled by a student, and rebooked by another, `DISTINCT s.id` guarantees it counts as exactly **one** utilized slot, preventing artificial inflation. |
| **Counsellor Session Fulfillment Rate** | $\frac{\text{COUNT}(\text{DISTINCT } b.\text{id WHERE } b.\text{status} = \text{'COMPLETED'} \text{ AND } s.\text{ends\_at} \le \text{LEAST}(\text{to}, \text{NOW}()))}{\text{COUNT}(\text{DISTINCT } b.\text{id WHERE } b.\text{status} \in \{\text{'COMPLETED'},\text{'CONFIRMED'}\} \text{ AND } s.\text{ends\_at} \le \text{LEAST}(\text{to}, \text{NOW}()))}$ | **Window & Eligibility:** Evaluated over bookings for slots with $s.\text{starts\_at} \in [\text{from}, \text{to}]$ whose scheduled end time has elapsed within the query window ($s.\text{ends\_at} \le \text{LEAST}(\text{to}, \text{NOW}())$).<br>**Numerator:** Distinct sessions verified as completed by the counsellor within the eligible elapsed set.<br>**Denominator:** All scheduled non-cancelled sessions (`'COMPLETED'` or `'CONFIRMED'`) within the identical eligible elapsed set. Future bookings whose end time has not elapsed are excluded from both numerator and denominator.<br>**Cancellation treatment:** Student-cancelled bookings are **excluded** from both numerator and denominator, ensuring counsellors are not penalized for student cancellations prior to the session. |
| **Booking Cancellation Rate** | $\frac{\text{COUNT}(\text{DISTINCT } b.\text{id WHERE } b.\text{status} = \text{'CANCELLED'})}{\text{COUNT}(\text{DISTINCT } b.\text{id})}$ | **Window:** Bookings for slots with $s.\text{starts\_at} \in [\text{from}, \text{to}]$.<br>**Numerator:** Distinct booking records transitioned to `'CANCELLED'`.<br>**Denominator:** Total distinct booking requests submitted for slots in the window.<br>**Purpose:** Identifies appointment attrition, scheduling conflicts, or timing friction before sessions occur. |

### What These Metrics Do NOT Measure

- Whether students actually made better career decisions (long-term outcome measurement is out of scope).
- Whether the career recommendations were objectively correct (similarity scores measure interest alignment, not career suitability).
- Whether the platform caused any change compared to not having the platform (no control group in a capstone demo).

---

## 10. Limitations and Honest Boundaries

| Limitation | Explanation |
|---|---|
| **Not a psychometric instrument** | The assessment measures self-reported interest preferences across six dimensions. It is not a validated psychological test and should not be treated as one. |
| **Not a career guarantee** | Recommendations are based on vector similarity between student interest profiles and career dimension profiles. A high similarity score means the career's profile is directionally similar to the student's expressed interests — nothing more. |
| **Limited career catalogue** | The MVP includes 10–15 curated careers. This is not representative of the full range of career options available to students. |
| **AI is supplementary** | MargDarshak AI explains recommendations; it does not generate them. If the AI is unavailable, the core recommendation engine still works. |
| **Single school / demo scope** | The MVP is designed for a single school or demo cohort. Multi-school tenancy requires additional work (see `docs/architecture.md` §13). |
| **No verified adoption data** | We have no data on actual school adoption, student satisfaction, or counsellor feedback. These would need to be collected through a structured pilot. |
| **No offline capability** | The web application requires an internet connection. Schools with unreliable connectivity may face access issues. |
| **No mobile-native app** | The frontend is a responsive web application, not a native mobile app. |
| **English only (MVP)** | The MVP interface and career catalogue are in English. Localization is not in scope. |
| **Three-person team** | Development capacity, testing coverage, and documentation depth are constrained by the team size and capstone timeline. |

---

## 11. Alignment with Team Deliverables

This business case supports the broader project deliverables:

| Team Member | How This Document Supports Their Work |
|---|---|
| **Divy (Backend/Mathematics)** | Business requirements inform API contract design, authentication requirements, and the scoring algorithm's role as a similarity measure (not a prediction). Privacy requirements shape analytics suppression rules. |
| **Dhavika (ISD/Frontend)** | User personas and journeys inform UI/UX design. Privacy requirements drive disclaimer placement and AI labelling. Adoption considerations influence accessibility and usability priorities. |
| **Aradhya (Data/Business)** | The business case justifies the data model design (why these entities, why these constraints). Measurable outcomes define the analytics queries. Privacy requirements drive data minimization in Mongo and PII redaction policies. |

---

## 12. Open Questions

> [!WARNING]
> These questions must be resolved with the team and/or mentor before deployment beyond a demo environment.

| # | Question | Owner | Impact |
|---|---|---|---|
| 1 | What specific consent mechanism is required for students under 18? | All + Mentor | Registration flow, consent fields, data processing justification |
| 2 | Is the platform intended for demonstration only, or is a real-school pilot planned? | All + Mentor | Determines privacy compliance scope, data handling, and infrastructure needs |
| 3 | Should the career catalogue be India-specific (NEP 2020 aligned) or generic? | Aradhya | Seed data, pathway content, entrance exam references |
| 4 | What is the LLM provider and budget for AI guidance? | Divy, Aradhya | Integration code, rate limiting, cost management |
| 5 | Does the capstone rubric require evidence of real user testing, or is synthetic demo sufficient? | All + Mentor | Test strategy, data handling, evaluation scope |
| 6 | How should the platform handle a student who disagrees with their recommendations? | Dhavika, Aradhya | UI messaging, disclaimer placement, counsellor referral flow |

