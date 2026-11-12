-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_skills" (
    "career_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "career_skills_pkey" PRIMARY KEY ("career_id","skill_id")
);

-- CreateTable
CREATE TABLE "education_pathways" (
    "id" UUID NOT NULL,
    "career_id" UUID NOT NULL,
    "stage" VARCHAR(50) NOT NULL,
    "qualification" VARCHAR(200) NOT NULL,
    "notes" TEXT,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_pathways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- AddForeignKey
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_pathways" ADD CONSTRAINT "education_pathways_career_id_fkey" FOREIGN KEY ("career_id") REFERENCES "careers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
