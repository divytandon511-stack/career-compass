export const createCareerController = ({ careerService } = {}) => {
  if (!careerService) throw new Error('createCareerController requires a careerService dependency');
  const run = (fn, status = 200) => async (req, res, next) => { try { const data = await fn(req); return res.status(status).json(data === undefined ? undefined : { data: data.data ?? data, ...(data.meta ? { meta: data.meta } : {}) }); } catch (e) { next(e); } };
  return {
    listCareers: run((r) => careerService.listCareers({ user: r.user, query: r.query })),
    getCareer: run((r) => careerService.getCareer({ user: r.user, idOrSlug: r.params.idOrSlug })),
    createCareer: run((r) => careerService.createCareer({ body: r.body }), 201),
    updateCareer: run((r) => careerService.updateCareer({ careerId: r.params.id, body: r.body })),
    archiveCareer: async (req, res, next) => { try { await careerService.archiveCareer({ careerId: req.params.id }); res.status(204).end(); } catch (e) { next(e); } },
    listSkills: run((r) => careerService.listSkills({ query: r.query })),
    createSkill: run((r) => careerService.createSkill({ body: r.body }), 201),
    listPathways: run((r) => careerService.listPathways({ careerId: r.params.id, query: r.query })),
    createPathway: run((r) => careerService.createPathway({ careerId: r.params.id, body: r.body }), 201),
    updatePathway: run((r) => careerService.updatePathway({ pathwayId: r.params.id, body: r.body })),
    listSavedCareers: run((r) => careerService.listSavedCareers({ user: r.user, query: r.query })),
    saveCareer: run((r) => careerService.saveCareer({ user: r.user, careerId: r.params.careerId })),
    unsaveCareer: async (req, res, next) => { try { await careerService.unsaveCareer({ user: req.user, careerId: req.params.careerId }); res.status(204).end(); } catch (e) { next(e); } },
  };
};
