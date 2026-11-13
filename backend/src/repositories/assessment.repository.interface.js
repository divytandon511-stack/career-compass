export class AssessmentRepositoryInterface {
  async listAssessments() {
    throw new Error('AssessmentRepositoryInterface.listAssessments must be implemented');
  }

  async getAssessment() {
    throw new Error('AssessmentRepositoryInterface.getAssessment must be implemented');
  }

  async getQuestions() {
    throw new Error('AssessmentRepositoryInterface.getQuestions must be implemented');
  }

  async createAttempt() {
    throw new Error('AssessmentRepositoryInterface.createAttempt must be implemented');
  }

  async listAttempts() {
    throw new Error('AssessmentRepositoryInterface.listAttempts must be implemented');
  }

  async getAttempt() {
    throw new Error('AssessmentRepositoryInterface.getAttempt must be implemented');
  }

  async saveAnswer() {
    throw new Error('AssessmentRepositoryInterface.saveAnswer must be implemented');
  }

  async finalizeAttempt() {
    throw new Error('AssessmentRepositoryInterface.finalizeAttempt must be implemented');
  }

  async listRecommendations() {
    throw new Error('AssessmentRepositoryInterface.listRecommendations must be implemented');
  }
}

