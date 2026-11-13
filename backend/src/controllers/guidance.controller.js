export const createGuidanceController = ({ service } = {}) => {
  if (!service) throw new Error('createGuidanceController requires a service dependency');
  const run = (handler, status = 200) => async (req, res, next) => {
    try {
      const data = await handler(req);
      return res.status(status).json({ data });
    } catch (error) {
      next(error);
    }
  };
  return {
    createSession: run((req) => service.createSession({ user: req.user, body: req.body }), 201),
    listSessions: run((req) => service.listSessions({ user: req.user, query: req.query })),
    getSession: run((req) => service.getSession({ user: req.user, sessionId: req.params.id })),
    sendMessage: run((req) => service.sendMessage({
      user: req.user,
      sessionId: req.params.id,
      body: req.body,
    })),
    deleteSession: async (req, res, next) => {
      try {
        await service.deleteSession({ user: req.user, sessionId: req.params.id });
        return res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
};
