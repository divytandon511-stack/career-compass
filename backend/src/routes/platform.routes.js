import { Router } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { createPlatformController } from '../controllers/platform.controller.js';

export const createPlatformRouter = ({ service, authenticate } = {}) => {
  if (!service || typeof authenticate !== 'function') {
    throw new Error('createPlatformRouter requires service and authenticate dependencies');
  }
  const router = Router();
  const controller = createPlatformController({ service });
  const auth = [authenticate];
  const admin = [authenticate, requireRole('ADMIN')];
  const student = [authenticate, requireRole('STUDENT')];
  const counsellor = [authenticate, requireRole('COUNSELLOR')];
  const studentOrCounsellor = [authenticate, requireRole('STUDENT', 'COUNSELLOR')];

  router.get('/users/me', ...auth, controller.getUser);
  router.patch('/users/me', ...auth, controller.updateUser);
  router.get('/admin/users', ...admin, controller.listUsers);
  router.patch('/admin/users/:id/status', ...admin, controller.updateUserStatus);

  router.post('/assessments', ...admin, controller.createAssessment);
  router.patch('/assessments/:id', ...admin, controller.updateAssessment);
  router.post('/assessments/:id/questions', ...admin, controller.createQuestion);
  router.patch('/questions/:id', ...admin, controller.updateQuestion);

  router.get('/counsellors', ...auth, controller.listCounsellors);
  router.get('/counsellors/:id', ...auth, controller.getCounsellor);
  router.get('/counsellors/me/slots', ...counsellor, controller.listOwnSlots);
  router.post('/counsellors/me/slots', ...counsellor, controller.createSlot);
  router.delete('/counsellors/me/slots/:id', ...counsellor, controller.deleteSlot);
  router.get('/counsellors/:id/slots', ...auth, controller.listSlots);

  router.post('/bookings', ...student, controller.createBooking);
  router.get('/bookings', ...studentOrCounsellor, controller.listBookings);
  router.get('/bookings/:id', ...studentOrCounsellor, controller.getBooking);
  router.patch('/bookings/:id/status', ...studentOrCounsellor, controller.updateBookingStatus);

  router.get('/analytics/overview', ...admin, controller.overviewAnalytics);
  router.get('/analytics/career-interests', ...admin, controller.careerInterestAnalytics);

  return router;
};
