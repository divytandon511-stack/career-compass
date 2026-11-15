export const createPlatformController = ({ service } = {}) => {
  if (!service) throw new Error('createPlatformController requires a service dependency');

  const respond = (res, result, status = 200) => res.status(status).json(
    result?.data && result?.meta ? result : { data: result }
  );
  const handle = (fn, status = 200) => async (req, res, next) => {
    try {
      return respond(res, await fn(req), status);
    } catch (error) {
      next(error);
    }
  };

  return {
    getUser: handle((req) => service.getUser(req.user.id)),
    updateUser: handle((req) => service.updateUser({ user: req.user, body: req.body })),
    listUsers: handle((req) => service.listUsers(req.query)),
    updateUserStatus: handle((req) => service.updateUserStatus({
      userId: req.params.id,
      body: req.body,
    })),
    createAssessment: handle((req) => service.createAssessment(req.body), 201),
    updateAssessment: handle((req) => service.updateAssessment({
      assessmentId: req.params.id,
      body: req.body,
    })),
    createQuestion: handle((req) => service.createQuestion({
      assessmentId: req.params.id,
      body: req.body,
    }), 201),
    updateQuestion: handle((req) => service.updateQuestion({
      questionId: req.params.id,
      body: req.body,
    })),
    listCounsellors: handle((req) => service.listCounsellors(req.query)),
    getCounsellor: handle((req) => service.getCounsellor(req.params.id)),
    listSlots: handle((req) => service.listSlots({
      counsellorId: req.params.id,
      query: req.query,
    })),
    listOwnSlots: handle((req) => service.listSlots({
      counsellorId: req.user.id,
      query: req.query,
      own: true,
    })),
    createSlot: handle((req) => service.createSlot({
      counsellorId: req.user.id,
      body: req.body,
    }), 201),
    deleteSlot: async (req, res, next) => {
      try {
        await service.deleteSlot({ counsellorId: req.user.id, slotId: req.params.id });
        return res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
    createBooking: handle((req) => service.createBooking({ user: req.user, body: req.body }), 201),
    listBookings: handle((req) => service.listBookings({ user: req.user, query: req.query })),
    getBooking: handle((req) => service.getBooking({ user: req.user, bookingId: req.params.id })),
    updateBookingStatus: handle((req) => service.updateBookingStatus({
      user: req.user,
      bookingId: req.params.id,
      body: req.body,
    })),
    overviewAnalytics: handle((req) => service.overviewAnalytics(req.query)),
    careerInterestAnalytics: handle((req) => service.careerInterestAnalytics(req.query)),
  };
};
