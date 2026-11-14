const formatAttempt = (attempt) => ({
  id: attempt.id,
  assessmentId: attempt.assessmentId,
  assessmentVersion: attempt.assessmentVersion,
  status: attempt.status,
  scoresJson: attempt.scoresJson || null,
  algorithmVersion: attempt.algorithmVersion || null,
  startedAt: attempt.startedAt,
  completedAt: attempt.completedAt,
  answers: (attempt.answers || []).map((answer) => ({
    questionId: answer.questionId,
    selectedOptionId: answer.selectedOptionId,
    answeredAt: answer.answeredAt,
  })),
  ...(attempt.status === 'COMPLETED'
    ? { recommendationsUrl: `/api/v1/attempts/${attempt.id}/recommendations` }
    : {}),
});

export const createAssessmentController = ({ assessmentService } = {}) => {
  if (!assessmentService) {
    throw new Error('createAssessmentController requires an assessmentService dependency');
  }

  return {
    listAssessments: async (req, res, next) => {
      try {
        const result = await assessmentService.listAssessments({
          user: req.user,
          query: req.query,
        });
        return res.status(200).json({ data: result.data, meta: result.meta });
      } catch (error) {
        next(error);
      }
    },

    getAssessment: async (req, res, next) => {
      try {
        const result = await assessmentService.getAssessment({
          user: req.user,
          assessmentId: req.params.id,
        });
        return res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },

    getQuestions: async (req, res, next) => {
      try {
        const result = await assessmentService.getQuestions({
          user: req.user,
          assessmentId: req.params.id,
          query: req.query,
        });
        if (result.meta) {
          return res.status(200).json({ data: result.data, meta: result.meta });
        }
        return res.status(200).json({ data: result.data || result });
      } catch (error) {
        next(error);
      }
    },

    startAttempt: async (req, res, next) => {
      try {
        const result = await assessmentService.startAttempt({
          user: req.user,
          assessmentId: req.params.id,
        });
        return res.status(201).json({ data: result });
      } catch (error) {
        next(error);
      }
    },

    listAttempts: async (req, res, next) => {
      try {
        const result = await assessmentService.listAttempts({
          user: req.user,
          query: req.query,
        });
        return res.status(200).json({ data: result.data, meta: result.meta });
      } catch (error) {
        next(error);
      }
    },

    getAttempt: async (req, res, next) => {
      try {
        const result = await assessmentService.getAttempt({
          user: req.user,
          attemptId: req.params.id,
        });
        return res.status(200).json({ data: formatAttempt(result) });
      } catch (error) {
        next(error);
      }
    },

    saveAnswer: async (req, res, next) => {
      try {
        const result = await assessmentService.saveAnswer({
          user: req.user,
          attemptId: req.params.id,
          questionId: req.params.questionId,
          body: req.body,
        });
        return res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },

    submitAttempt: async (req, res, next) => {
      try {
        const result = await assessmentService.submitAttempt({
          user: req.user,
          attemptId: req.params.id,
        });
        return res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },

    listRecommendations: async (req, res, next) => {
      try {
        const result = await assessmentService.listRecommendations({
          user: req.user,
          attemptId: req.params.id,
          query: req.query,
        });
        return res.status(200).json({ data: result.data, meta: result.meta });
      } catch (error) {
        next(error);
      }
    },
  };
};

