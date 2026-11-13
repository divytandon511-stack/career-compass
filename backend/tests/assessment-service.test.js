import { describe, expect, it, vi } from 'vitest';

import { AssessmentService } from '../src/services/assessment.service.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'STUDENT',
};

const attemptId = '22222222-2222-4222-8222-222222222222';
const assessmentId = '33333333-3333-4333-8333-333333333333';
const questionId = '44444444-4444-4444-8444-444444444444';

describe('AssessmentService', () => {
  it('passes authenticated ownership and validated option IDs to the repository', async () => {
    const assessmentRepository = {
      saveAnswer: vi.fn().mockResolvedValue({
        attemptId,
        questionId,
        selectedOptionId: 'option-a',
      }),
    };
    const service = new AssessmentService({ assessmentRepository });

    await expect(
      service.saveAnswer({
        user,
        attemptId,
        questionId,
        body: { optionId: ' option-a ' },
      })
    ).resolves.toEqual({
      attemptId,
      questionId,
      selectedOptionId: 'option-a',
    });

    expect(assessmentRepository.saveAnswer).toHaveBeenCalledWith({
      studentId: user.id,
      attemptId,
      questionId,
      selectedOptionId: 'option-a',
    });
  });

  it('rejects malformed identifiers and unknown answer fields before persistence', async () => {
    const assessmentRepository = { saveAnswer: vi.fn() };
    const service = new AssessmentService({ assessmentRepository });

    let malformedError;
    try {
      await service.saveAnswer({
        user,
        attemptId: 'not-a-uuid',
        questionId,
        body: { optionId: 'option-a' },
      });
    } catch (error) {
      malformedError = error;
    }
    expect(malformedError).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 422 });

    let unknownFieldError;
    try {
      await service.saveAnswer({
        user,
        attemptId,
        questionId,
        body: { optionId: 'option-a', score: 4 },
      });
    } catch (error) {
      unknownFieldError = error;
    }
    expect(unknownFieldError).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 422 });

    expect(assessmentRepository.saveAnswer).not.toHaveBeenCalled();
  });

  it('uses the authenticated user for attempt and recommendation queries', async () => {
    const assessmentRepository = {
      getAttempt: vi.fn().mockResolvedValue({ id: attemptId }),
      listRecommendations: vi.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    const service = new AssessmentService({ assessmentRepository });

    await service.getAttempt({ user, attemptId });
    await service.listRecommendations({ user, attemptId, query: {} });

    expect(assessmentRepository.getAttempt).toHaveBeenCalledWith({
      studentId: user.id,
      attemptId,
    });
    expect(assessmentRepository.listRecommendations).toHaveBeenCalledWith({
      studentId: user.id,
      attemptId,
      page: 1,
      limit: 20,
    });
  });
});

