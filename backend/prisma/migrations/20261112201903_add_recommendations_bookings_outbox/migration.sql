-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "career_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "similarity_score" DECIMAL(7,6) NOT NULL,
    "explanation_json" JSONB,
    "algorithm_version" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_careers" (
    "student_id" UUID NOT NULL,
    "career_id" UUID NOT NULL,
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_careers_pkey" PRIMARY KEY ("student_id","career_id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" UUID NOT NULL,
    "counsellor_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "counsellor_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ,
    "idempotency_key" VARCHAR(36),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "recommendations"
ADD CONSTRAINT "recommendations_rank_check" CHECK ("rank" >= 1);

-- AddCheckConstraint
ALTER TABLE "recommendations"
ADD CONSTRAINT "recommendations_similarity_score_check"
CHECK ("similarity_score" >= 0 AND "similarity_score" <= 1);

-- AddCheckConstraint
ALTER TABLE "availability_slots"
ADD CONSTRAINT "availability_slots_ends_at_check" CHECK ("ends_at" > "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_attempt_id_career_id_key" ON "recommendations"("attempt_id", "career_id");

-- CreateIndex
CREATE INDEX "availability_slots_counsellor_id_starts_at_idx" ON "availability_slots"("counsellor_id", "starts_at");

-- CreateIndex
CREATE INDEX "availability_slots_status_idx" ON "availability_slots"("status");

-- CreateIndex
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");

-- CreateIndex
CREATE INDEX "bookings_student_id_idx" ON "bookings"("student_id");

-- CreateIndex
CREATE INDEX "bookings_counsellor_id_idx" ON "bookings"("counsellor_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bookings_active_or_completed_slot"
ON "bookings"("slot_id")
WHERE "status" IN ('CONFIRMED'::"BookingStatus", 'COMPLETED'::"BookingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "email_outbox_idempotency_key_key" ON "email_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_careers" ADD CONSTRAINT "saved_careers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_careers" ADD CONSTRAINT "saved_careers_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_counsellor_id_fkey" FOREIGN KEY ("counsellor_id") REFERENCES "counsellor_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_counsellor_id_fkey" FOREIGN KEY ("counsellor_id") REFERENCES "counsellor_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
