import { AppError } from '../utils/app-error.js';

const page = ({ page = 1, limit = 20 }) => ({ page: Number(page), limit: Number(limit) });
const meta = ({ page: p, limit, total }) => ({ page: p, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 });
const mapError = (error, message = 'Career resource not found') => {
  if (error instanceof AppError) throw error;
  if (error?.code === 'P2002') throw new AppError('CONFLICT', 'A resource with that value already exists', 409);
  if (error?.code === 'P2025') throw new AppError('NOT_FOUND', message, 404);
  if (error?.code === 'P2003') throw new AppError('NOT_FOUND', message, 404);
  throw error;
};
const careerSelect = { id: true, slug: true, title: true, description: true, published: true, profileVersion: true, sourceNote: true, createdAt: true, updatedAt: true };
const mapCareer = (c, detail = false) => ({
  id: c.id, slug: c.slug, title: c.title, ...(detail ? { description: c.description, published: c.published, profileVersion: c.profileVersion, sourceNote: c.sourceNote, dimensions: (c.dimensions || []).map((d) => ({ dimension: d.dimension, targetWeight: Number(d.targetWeight) })), skills: (c.careerSkills || []).map((x) => x.skill), pathways: c.pathways || [], createdAt: c.createdAt, updatedAt: c.updatedAt } : { summary: c.description }),
});

export class CareerRepositoryAdapter {
  constructor({ dbClient } = {}) { if (!dbClient) throw new Error('CareerRepositoryAdapter requires a dbClient dependency'); this.dbClient = dbClient; }

  async listCareers({ role, q, skillId, published, sort = 'title', order = 'asc', ...paging } = {}) {
    const p = page(paging); const isAdmin = role === 'ADMIN';
    const where = { ...(isAdmin && published !== undefined ? { published } : isAdmin ? {} : { published: true }), ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}), ...(skillId ? { careerSkills: { some: { skillId } } } : {}) };
    try {
      const [items, total] = await Promise.all([
        this.dbClient.career.findMany({ where, orderBy: { [sort]: order }, skip: (p.page - 1) * p.limit, take: p.limit, select: careerSelect }),
        this.dbClient.career.count({ where }),
      ]);
      return { data: items.map((x) => mapCareer(x)), meta: meta({ ...p, total }) };
    } catch (e) { mapError(e, 'Career not found'); }
  }
  async getCareer({ idOrSlug, role } = {}) {
    try {
      const c = await this.dbClient.career.findFirst({ where: { ...(idOrSlug.match(/^[0-9a-f-]{36}$/i) ? { id: idOrSlug } : { slug: idOrSlug }), ...(role === 'ADMIN' ? {} : { published: true }) }, include: { dimensions: true, careerSkills: { include: { skill: true } }, pathways: { orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'asc' }] } } });
      if (!c) throw new AppError('NOT_FOUND', 'Career not found', 404);
      return mapCareer(c, true);
    } catch (e) { mapError(e); }
  }
  async createCareer({ data }) {
    try {
      const c = await this.dbClient.career.create({ data: { slug: data.slug, title: data.title, description: data.description ?? null, dimensions: { create: Object.entries(data.dimensionProfile).map(([dimension, targetWeight]) => ({ dimension, targetWeight })) }, ...(data.skillIds.length ? { careerSkills: { create: data.skillIds.map((skillId) => ({ skill: { connect: { id: skillId } } })) } } : {}), ...(data.pathways.length ? { pathways: { create: data.pathways } } : {}) }, include: { dimensions: true, careerSkills: { include: { skill: true } }, pathways: true } });
      return mapCareer(c, true);
    } catch (e) { mapError(e); }
  }
  async updateCareer({ careerId, data }) {
    try {
      const update = { ...(data.title !== undefined ? { title: data.title } : {}), ...(data.description !== undefined ? { description: data.description } : {}), ...(data.dimensionProfile ? { dimensions: { deleteMany: {}, create: Object.entries(data.dimensionProfile).map(([dimension, targetWeight]) => ({ dimension, targetWeight })) }, profileVersion: { increment: 1 } } : {}) };
      if (data.skillIds) update.careerSkills = { deleteMany: {}, create: data.skillIds.map((skillId) => ({ skill: { connect: { id: skillId } } })) };
      const c = await this.dbClient.career.update({ where: { id: careerId }, data: update, include: { dimensions: true, careerSkills: { include: { skill: true } }, pathways: true } });
      return mapCareer(c, true);
    } catch (e) { mapError(e); }
  }
  async archiveCareer({ careerId }) { try { await this.dbClient.career.update({ where: { id: careerId }, data: { published: false } }); } catch (e) { mapError(e); } }
  async listSkills({ q, sort = 'name', order = 'asc', ...paging } = {}) { const p = page(paging); const where = q ? { name: { contains: q, mode: 'insensitive' } } : {}; try { const [data, total] = await Promise.all([this.dbClient.skill.findMany({ where, orderBy: { [sort]: order }, skip: (p.page - 1) * p.limit, take: p.limit }), this.dbClient.skill.count({ where })]); return { data, meta: meta({ ...p, total }) }; } catch (e) { mapError(e); } }
  async createSkill({ name }) { try { return await this.dbClient.skill.create({ data: { name } }); } catch (e) { mapError(e); } }
  async listPathways({ careerId, ...paging } = {}) { const p = page(paging); const where = { careerId }; try { const career = await this.dbClient.career.findFirst({ where: { id: careerId, published: true }, select: { id: true } }); if (!career) throw new AppError('NOT_FOUND', 'Career not found', 404); const [data, total] = await Promise.all([this.dbClient.educationPathway.findMany({ where, orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'asc' }], skip: (p.page - 1) * p.limit, take: p.limit }), this.dbClient.educationPathway.count({ where })]); return { data, meta: meta({ ...p, total }) }; } catch (e) { mapError(e); } }
  async createPathway({ careerId, data }) { try { return await this.dbClient.educationPathway.create({ data: { careerId, ...data } }); } catch (e) { mapError(e); } }
  async updatePathway({ pathwayId, data }) { try { return await this.dbClient.educationPathway.update({ where: { id: pathwayId }, data }); } catch (e) { mapError(e); } }
  async listSavedCareers({ studentId, sort = 'savedAt', order = 'desc', ...paging } = {}) { const p = page(paging); const where = { studentId }; try { const [rows, total] = await Promise.all([this.dbClient.savedCareer.findMany({ where, orderBy: { [sort]: order }, skip: (p.page - 1) * p.limit, take: p.limit, include: { career: { select: careerSelect } } }), this.dbClient.savedCareer.count({ where })]); return { data: rows.map((r) => ({ ...mapCareer(r.career), savedAt: r.savedAt })), meta: meta({ ...p, total }) }; } catch (e) { mapError(e); } }
  async saveCareer({ studentId, careerId }) { try { const career = await this.dbClient.career.findFirst({ where: { id: careerId, published: true }, select: { id: true } }); if (!career) throw new AppError('NOT_FOUND', 'Career not found', 404); const row = await this.dbClient.savedCareer.upsert({ where: { studentId_careerId: { studentId, careerId } }, create: { studentId, careerId }, update: {}, include: { career: { select: careerSelect } } }); return { career: mapCareer(row.career), savedAt: row.savedAt }; } catch (e) { mapError(e); } }
  async unsaveCareer({ studentId, careerId }) { try { await this.dbClient.savedCareer.deleteMany({ where: { studentId, careerId } }); } catch (e) { mapError(e); } }
}
