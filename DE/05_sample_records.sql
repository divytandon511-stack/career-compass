-- ============================================================================
-- CareerCompass — Sample Records Demonstration Script
-- ============================================================================
-- Component: Data Engineering Deliverable #5
-- Database Engine: PostgreSQL 16
-- Purpose: Demonstrates populated data across all normalized tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS & PROFILES
-- ----------------------------------------------------------------------------

-- Insert Student User
INSERT INTO users (id, email, password_hash, display_name, role, status) VALUES
('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'student.demo@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashstudent', 'Aarav Sharma', 'STUDENT', 'ACTIVE'),
('4fa85f64-5717-4562-b3fc-2c963f66afa7', 'student.riya@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashriya', 'Riya Patel', 'STUDENT', 'ACTIVE'),
('5fa85f64-5717-4562-b3fc-2c963f66afa8', 'student.kabir@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashkabir', 'Kabir Verma', 'STUDENT', 'ACTIVE');

-- Insert Counsellor User
INSERT INTO users (id, email, password_hash, display_name, role, status) VALUES
('8fa85f64-5717-4562-b3fc-2c963f66afa9', 'counsellor.priya@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashcounsellor', 'Dr. Priya Desai', 'COUNSELLOR', 'ACTIVE'),
('9fa85f64-5717-4562-b3fc-2c963f66afb0', 'counsellor.rajesh@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashrajesh', 'Rajesh Nair', 'COUNSELLOR', 'ACTIVE');

-- Insert Admin User
INSERT INTO users (id, email, password_hash, display_name, role, status) VALUES
('1fa85f64-5717-4562-b3fc-2c963f66afb1', 'admin@careercompass.org', '$argon2id$v=19$m=65536,t=3,p=4$dummyhashadmin', 'Admin Coordinator', 'ADMIN', 'ACTIVE');

-- Insert Student Profiles
INSERT INTO student_profiles (user_id, school_grade, consent_accepted) VALUES
('3fa85f64-5717-4562-b3fc-2c963f66afa6', '10', TRUE),
('4fa85f64-5717-4562-b3fc-2c963f66afa7', '11', TRUE),
('5fa85f64-5717-4562-b3fc-2c963f66afa8', '9', TRUE);

-- Insert Counsellor Profiles
INSERT INTO counsellor_profiles (user_id, display_name, bio, active) VALUES
('8fa85f64-5717-4562-b3fc-2c963f66afa9', 'Dr. Priya Desai', 'Certified Secondary School Career Counsellor with 12+ years of experience in STEM and humanities guidance.', TRUE),
('9fa85f64-5717-4562-b3fc-2c963f66afb0', 'Rajesh Nair', 'Educational advisor specializing in vocational and emerging technology streams.', TRUE);

-- ----------------------------------------------------------------------------
-- 2. ASSESSMENT & QUESTIONS
-- ----------------------------------------------------------------------------

-- Insert Canonical Published Assessment
INSERT INTO assessments (id, title, description, version, status) VALUES
('a0000000-0000-0000-0000-000000000001', 'CareerCompass Secondary Exploratory Profiler (NEP 2020)', 'Official 30-question interest assessment measuring student dimensional preferences.', 1, 'PUBLISHED');

-- Sample Question Definitions (Analytical and Investigative dimensions)
INSERT INTO questions (id, assessment_id, dimension, prompt, position, weight, options) VALUES
('q0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'ANALYTICAL', 'When given a complex problem, I enjoy breaking it down into smaller logical steps.', 1, 1.0000,
 '[{"id":"opt-1","label":"Strongly Disagree","score":1},{"id":"opt-2","label":"Disagree","score":2},{"id":"opt-3","label":"Neutral","score":3},{"id":"opt-4","label":"Agree","score":4},{"id":"opt-5","label":"Strongly Agree","score":5}]'::jsonb),
('q0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'INVESTIGATIVE', 'I enjoy reading scientific articles or exploring how natural phenomena work.', 2, 1.0000,
 '[{"id":"opt-1","label":"Strongly Disagree","score":1},{"id":"opt-2","label":"Disagree","score":2},{"id":"opt-3","label":"Neutral","score":3},{"id":"opt-4","label":"Agree","score":4},{"id":"opt-5","label":"Strongly Agree","score":5}]'::jsonb),
('q0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CREATIVE', 'I like creating visual art, music, or writing original fictional stories.', 3, 1.0000,
 '[{"id":"opt-1","label":"Strongly Disagree","score":1},{"id":"opt-2","label":"Disagree","score":2},{"id":"opt-3","label":"Neutral","score":3},{"id":"opt-4","label":"Agree","score":4},{"id":"opt-5","label":"Strongly Agree","score":5}]'::jsonb);

-- ----------------------------------------------------------------------------
-- 3. CAREERS, DIMENSIONS, SKILLS & PATHWAYS
-- ----------------------------------------------------------------------------

-- Insert Careers
INSERT INTO careers (id, slug, title, description, published, profile_version, source_note) VALUES
('c1000000-0000-0000-0000-000000000001', 'ai-research-scientist', 'AI & Machine Learning Scientist', 'Develops mathematical learning algorithms and deep neural architectures.', TRUE, 1, 'National Occupational Classification & NEP 2020 STEM Blueprint'),
('c1000000-0000-0000-0000-000000000002', 'renewable-energy-architect', 'Renewable Energy Systems Engineer', 'Designs solar, wind, and microgrid infrastructure for clean energy transitions.', TRUE, 1, 'Ministry of New and Renewable Energy (MNRE) Industry Guide'),
('c1000000-0000-0000-0000-000000000003', 'clinical-psychologist', 'Child & Adolescent Clinical Psychologist', 'Diagnoses and supports cognitive, developmental, and emotional health.', TRUE, 1, 'Rehabilitation Council of India (RCI) Professional Standard');

-- Career Dimension Vectors (Target Weights)
INSERT INTO career_dimensions (id, career_id, dimension, target_weight) VALUES
('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ANALYTICAL', 0.9500),
('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'INVESTIGATIVE', 0.9000),
('d1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'ANALYTICAL', 0.8500),
('d1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000002', 'PRACTICAL', 0.8000),
('d1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003', 'SOCIAL', 0.9500),
('d1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000003', 'INVESTIGATIVE', 0.8500);

-- Skills
INSERT INTO skills (id, name) VALUES
('s0000000-0000-0000-0000-000000000001', 'Linear Algebra & Calculus'),
('s0000000-0000-0000-0000-000000000002', 'Python & PyTorch'),
('s0000000-0000-0000-0000-000000000003', 'Thermodynamics & Power Systems'),
('s0000000-0000-0000-0000-000000000004', 'Active Listening & Empathy');

-- Career Skills Junction
INSERT INTO career_skills (career_id, skill_id) VALUES
('c1000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001'),
('c1000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002'),
('c1000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001'),
('c1000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000003'),
('c1000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000004');

-- Education Pathways
INSERT INTO education_pathways (id, career_id, stage, qualification, notes) VALUES
('p0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'SECONDARY', 'Class 11–12 with Physics, Chemistry, and Mathematics (PCM)', 'Computer Science elective recommended.'),
('p0000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'UNDERGRADUATE', 'B.Tech in Computer Science / AI & Data Science', 'Admission via JEE Main / Advanced.'),
('p0000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'SECONDARY', 'Class 11–12 with PCM', 'Focus on Environmental Science / Physics.'),
('p0000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003', 'SECONDARY', 'Class 11–12 with Psychology / Humanities or Biology', 'Minimum 50% aggregate required.');

-- ----------------------------------------------------------------------------
-- 4. ATTEMPTS, ANSWERS & RECOMMENDATIONS
-- ----------------------------------------------------------------------------

-- Completed Assessment Attempt
INSERT INTO assessment_attempts (id, student_id, assessment_id, assessment_version, status, scores_json, algorithm_version, started_at, completed_at) VALUES
('att00000-0000-0000-0000-000000000001', '3fa85f64-5717-4562-b3fc-2c963f66afa6', 'a0000000-0000-0000-0000-000000000001', 1, 'COMPLETED',
 '{"ANALYTICAL":0.92,"INVESTIGATIVE":0.88,"CREATIVE":0.40,"SOCIAL":0.35,"PRACTICAL":0.55,"ORGANIZATIONAL":0.60}'::jsonb,
 'cosine-v1', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '25 minutes');

-- Sample Answers
INSERT INTO answers (id, attempt_id, question_id, selected_option_id, score, answered_at) VALUES
('ans00000-0000-0000-0000-000000000001', 'att00000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000001', 'opt-5', 5, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '2 minutes'),
('ans00000-0000-0000-0000-000000000002', 'att00000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000002', 'opt-5', 5, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '4 minutes'),
('ans00000-0000-0000-0000-000000000003', 'att00000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000003', 'opt-2', 2, CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '6 minutes');

-- Generated Ranked Recommendations
INSERT INTO recommendations (id, attempt_id, career_id, rank, similarity_score, explanation_json, algorithm_version) VALUES
('rec00000-0000-0000-0000-000000000001', 'att00000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, 0.941200,
 '{"topDimensions":["ANALYTICAL","INVESTIGATIVE"],"matchStrength":"VERY_HIGH"}'::jsonb, 'cosine-v1'),
('rec00000-0000-0000-0000-000000000002', 'att00000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 2, 0.812400,
 '{"topDimensions":["ANALYTICAL","PRACTICAL"],"matchStrength":"HIGH"}'::jsonb, 'cosine-v1');

-- Bookmarked Career
INSERT INTO saved_careers (student_id, career_id, saved_at) VALUES
('3fa85f64-5717-4562-b3fc-2c963f66afa6', 'c1000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - INTERVAL '1 day');

-- ----------------------------------------------------------------------------
-- 5. AVAILABILITY SLOTS & BOOKINGS
-- ----------------------------------------------------------------------------

-- Availability Slots
INSERT INTO availability_slots (id, counsellor_id, starts_at, ends_at, status) VALUES
('slot0000-0000-0000-0000-000000000001', '8fa85f64-5717-4562-b3fc-2c963f66afa9', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '4 hours', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '4 hours 45 minutes', 'BOOKED'),
('slot0000-0000-0000-0000-000000000002', '8fa85f64-5717-4562-b3fc-2c963f66afa9', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '5 hours', CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '5 hours 45 minutes', 'AVAILABLE'),
('slot0000-0000-0000-0000-000000000003', '9fa85f64-5717-4562-b3fc-2c963f66afb0', CURRENT_TIMESTAMP + INTERVAL '2 days' + INTERVAL '3 hours', CURRENT_TIMESTAMP + INTERVAL '2 days' + INTERVAL '3 hours 45 minutes', 'AVAILABLE');

-- Confirmed Booking
INSERT INTO bookings (id, student_id, counsellor_id, slot_id, status, note) VALUES
('book0000-0000-0000-0000-000000000001', '3fa85f64-5717-4562-b3fc-2c963f66afa6', '8fa85f64-5717-4562-b3fc-2c963f66afa9', 'slot0000-0000-0000-0000-000000000001', 'CONFIRMED', 'Discussing Grade 11 PCM vs Computer Science stream options.');

-- ----------------------------------------------------------------------------
-- 6. MONGODB SAMPLE DOCUMENT (For mongosh / MongoDB Compass)
-- ----------------------------------------------------------------------------
/*
db.guidance_sessions.insertOne({
  sessionId: "6af9f38336ef077cda7ec60c",
  studentId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  attemptId: "att00000-0000-0000-0000-000000000001",
  careerIds: ["c1000000-0000-0000-0000-000000000001"],
  messages: [
    {
      role: "assistant",
      text: "Namaste Aarav! I am your MargDarshak AI advisor. How can I assist with your AI Scientist roadmap?",
      groundingCareerIds: ["c1000000-0000-0000-0000-000000000001"],
      createdAt: new Date()
    }
  ],
  model: "qwen/qwen3.8-27b",
  consentVersion: "v1",
  createdAt: new Date(),
  updatedAt: new Date()
});
*/
