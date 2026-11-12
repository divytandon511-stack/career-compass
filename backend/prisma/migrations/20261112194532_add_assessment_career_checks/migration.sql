ALTER TABLE "questions"
ADD CONSTRAINT "questions_weight_positive" CHECK ("weight" > 0);

ALTER TABLE "answers"
ADD CONSTRAINT "answers_score_range" CHECK ("score" >= 0 AND "score" <= 4);

ALTER TABLE "career_dimensions"
ADD CONSTRAINT "career_dimensions_target_weight_range"
CHECK ("target_weight" >= 0 AND "target_weight" <= 1);