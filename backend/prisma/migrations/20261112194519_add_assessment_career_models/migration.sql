-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('ANALYTICAL', 'CREATIVE', 'SOCIAL', 'PRACTICAL', 'ORGANIZATIONAL', 'INVESTIGATIVE');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "prompt" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "options" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "assessment_version" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "scores_json" JSONB,
    "algorithm_version" VARCHAR(50),
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" VARCHAR(36) NOT NULL,
    "score" INTEGER NOT NULL,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "profile_version" INTEGER NOT NULL DEFAULT 1,
    "source_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_dimensions" (
    "id" UUID NOT NULL,
    "career_id" UUID NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "target_weight" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "career_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "questions_assessment_id_position_key" ON "questions"("assessment_id", "position");

-- CreateIndex
CREATE INDEX "assessment_attempts_student_id_idx" ON "assessment_attempts"("student_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessment_id_idx" ON "assessment_attempts"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_status_idx" ON "assessment_attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attempt_id_question_id_key" ON "answers"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "careers_slug_key" ON "careers"("slug");

-- CreateIndex
CREATE INDEX "careers_published_idx" ON "careers"("published");

-- CreateIndex
CREATE UNIQUE INDEX "career_dimensions_career_id_dimension_key" ON "career_dimensions"("career_id", "dimension");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_dimensions" ADD CONSTRAINT "career_dimensions_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
