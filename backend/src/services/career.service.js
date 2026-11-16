import { AppError } from '../utils/app-error.js';
import {
  careerListQuerySchema, skillListQuerySchema, pathwayListQuerySchema, careerIdSchema,
  careerLookupSchema, skillIdSchema, pathwayIdSchema, careerCreateSchema, careerUpdateSchema,
  skillCreateSchema, pathwayCreateSchema, pathwayUpdateSchema, savedCareerListQuerySchema,
  formatCareerValidationIssues,
} from '../validators/career.validator.js';

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION_ERROR', 'Please correct the supplied fields.', 422, formatCareerValidationIssues(result.error));
  return result.data;
};
export class CareerService {
  constructor({ careerRepository } = {}) { if (!careerRepository) throw new Error('CareerService requires a careerRepository dependency'); this.careerRepository = careerRepository; }
  listCareers({ user, query }) { return this.careerRepository.listCareers({ role: user?.role, ...parse(careerListQuerySchema, query) }); }
  getCareer({ user, idOrSlug }) { return this.careerRepository.getCareer({ role: user?.role, ...parse(careerLookupSchema, { idOrSlug }) }); }
  createCareer({ body }) { return this.careerRepository.createCareer({ data: parse(careerCreateSchema, body) }); }
  updateCareer({ careerId, body }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.updateCareer({ careerId: id, data: parse(careerUpdateSchema, body) }); }
  archiveCareer({ careerId }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.archiveCareer({ careerId: id }); }
  listSkills({ query }) { return this.careerRepository.listSkills(parse(skillListQuerySchema, query)); }
  createSkill({ body }) { return this.careerRepository.createSkill(parse(skillCreateSchema, body)); }
  listPathways({ careerId, query }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.listPathways({ careerId: id, ...parse(pathwayListQuerySchema, query) }); }
  createPathway({ careerId, body }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.createPathway({ careerId: id, data: parse(pathwayCreateSchema, body) }); }
  updatePathway({ pathwayId, body }) { const { id } = parse(pathwayIdSchema, { id: pathwayId }); return this.careerRepository.updatePathway({ pathwayId: id, data: parse(pathwayUpdateSchema, body) }); }
  listSavedCareers({ user, query }) { return this.careerRepository.listSavedCareers({ studentId: user.id, ...parse(savedCareerListQuerySchema, query) }); }
  saveCareer({ user, careerId }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.saveCareer({ studentId: user.id, careerId: id }); }
  unsaveCareer({ user, careerId }) { const { id } = parse(careerIdSchema, { id: careerId }); return this.careerRepository.unsaveCareer({ studentId: user.id, careerId: id }); }
}
export const createCareerService = (dependencies) => new CareerService(dependencies);
