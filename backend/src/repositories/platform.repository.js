import { AppError } from '../utils/app-error.js';

const page = ({ page = 1, limit = 20 } = {}) => ({
  page: Math.max(1, Number(page)),
  limit: Math.min(50, Math.max(1, Number(limit))),
});

const metadata = ({ page: currentPage, limit, total }) => ({
  page: currentPage,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

const mapUser = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  status: user.status,
  profile: user.studentProfile || user.counsellorProfile || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const mapSlot = (slot) => ({
  id: slot.id,
  counsellorId: slot.counsellorId,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  status: slot.status,
});

const mapBooking = (booking) => ({
  id: booking.id,
  slotId: booking.slotId,
  studentId: booking.studentId,
  counsellorId: booking.counsellorId,
  status: booking.status,
  note: booking.note,
  startsAt: booking.slot?.startsAt,
  endsAt: booking.slot?.endsAt,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
  notificationStatus: 'PENDING',
});

export class PlatformRepository {
  constructor({ dbClient } = {}) {
    if (!dbClient || typeof dbClient !== 'object') {
      throw new Error('PlatformRepository requires a dbClient dependency');
    }
    this.dbClient = dbClient;
  }

  async getUser(userId) {
    const user = await this.dbClient.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, counsellorProfile: true },
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
    return mapUser(user);
  }

  async updateUser({ userId, displayName, schoolGrade }) {
    const user = await this.dbClient.user.update({
      where: { id: userId },
      data: {
        ...(displayName === undefined ? {} : { displayName }),
        ...(schoolGrade === undefined
          ? {}
          : { studentProfile: { update: { schoolGrade } } }),
      },
      include: { studentProfile: true, counsellorProfile: true },
    });
    return mapUser(user);
  }

  async listUsers({ page: pageNumber, limit, role, status, sort = 'createdAt', order = 'desc' } = {}) {
    const pagination = page({ page: pageNumber, limit });
    const where = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    };
    const [users, total] = await Promise.all([
      this.dbClient.user.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: { studentProfile: true, counsellorProfile: true },
      }),
      this.dbClient.user.count({ where }),
    ]);
    return { data: users.map(mapUser), meta: metadata({ ...pagination, total }) };
  }

  async updateUserStatus({ userId, status }) {
    try {
      return mapUser(await this.dbClient.user.update({
        where: { id: userId },
        data: { status },
        include: { studentProfile: true, counsellorProfile: true },
      }));
    } catch (error) {
      if (error?.code === 'P2025') throw new AppError('NOT_FOUND', 'User not found', 404);
      throw error;
    }
  }

  async createAssessment({ title, description, version }) {
    return this.dbClient.assessment.create({
      data: { title, description, version },
    });
  }

  async updateAssessment({ assessmentId, data }) {
    const existing = await this.dbClient.assessment.findUnique({ where: { id: assessmentId } });
    if (!existing) throw new AppError('NOT_FOUND', 'Assessment not found', 404);
    if (existing.status !== 'DRAFT') {
      throw new AppError('CONFLICT', 'Published assessment versions are immutable', 409);
    }
    if (data.status === 'PUBLISHED') {
      const questions = await this.dbClient.question.findMany({ where: { assessmentId } });
      const dimensions = new Set(questions.map(({ dimension }) => dimension));
      const requiredDimensions = [
        'ANALYTICAL',
        'CREATIVE',
        'SOCIAL',
        'PRACTICAL',
        'ORGANIZATIONAL',
        'INVESTIGATIVE',
      ];
      if (requiredDimensions.some((dimension) => !dimensions.has(dimension))) {
        throw new AppError('CONFLICT', 'Published assessments must cover all six dimensions', 409);
      }
    }
    return this.dbClient.assessment.update({ where: { id: assessmentId }, data });
  }

  async createQuestion({ assessmentId, data }) {
    const assessment = await this.dbClient.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new AppError('NOT_FOUND', 'Assessment not found', 404);
    if (assessment.status !== 'DRAFT') {
      throw new AppError('CONFLICT', 'Published assessment versions are immutable', 409);
    }
    try {
      return await this.dbClient.question.create({ data: { assessmentId, ...data } });
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new AppError('CONFLICT', 'Question position already exists', 409);
      }
      throw error;
    }
  }

  async updateQuestion({ questionId, data }) {
    const question = await this.dbClient.question.findUnique({
      where: { id: questionId },
      include: { assessment: true },
    });
    if (!question) throw new AppError('NOT_FOUND', 'Question not found', 404);
    if (question.assessment.status !== 'DRAFT') {
      throw new AppError('CONFLICT', 'Published assessment versions are immutable', 409);
    }
    return this.dbClient.question.update({ where: { id: questionId }, data });
  }

  async listCounsellors({ page: pageNumber, limit, q, sort = 'displayName', order = 'asc' } = {}) {
    const pagination = page({ page: pageNumber, limit });
    const where = {
      active: true,
      ...(q ? { displayName: { contains: q, mode: 'insensitive' } } : {}),
    };
    const [profiles, total] = await Promise.all([
      this.dbClient.counsellorProfile.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.dbClient.counsellorProfile.count({ where }),
    ]);
    return { data: profiles, meta: metadata({ ...pagination, total }) };
  }

  async getCounsellor({ counsellorId }) {
    const profile = await this.dbClient.counsellorProfile.findFirst({
      where: { userId: counsellorId, active: true },
    });
    if (!profile) throw new AppError('NOT_FOUND', 'Counsellor not found', 404);
    return profile;
  }

  async listSlots({ counsellorId, from, to, own = false, page: pageNumber, limit } = {}) {
    const pagination = page({ page: pageNumber, limit });
    const startsAt = {
      ...(own ? {} : { gt: new Date() }),
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const where = {
      counsellorId,
      ...(own ? {} : { status: 'AVAILABLE' }),
      ...(own || from || to ? { startsAt } : {}),
    };
    const [slots, total] = await Promise.all([
      this.dbClient.availabilitySlot.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.dbClient.availabilitySlot.count({ where }),
    ]);
    return { data: slots.map(mapSlot), meta: metadata({ ...pagination, total }) };
  }

  async createSlot({ counsellorId, startsAt, endsAt }) {
    const overlap = await this.dbClient.availabilitySlot.findFirst({
      where: {
        counsellorId,
        status: { not: 'CANCELLED' },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap) throw new AppError('CONFLICT', 'Counsellor already has an overlapping slot', 409);
    return mapSlot(await this.dbClient.availabilitySlot.create({
      data: { counsellorId, startsAt, endsAt },
    }));
  }

  async deleteSlot({ counsellorId, slotId }) {
    const slot = await this.dbClient.availabilitySlot.findFirst({
      where: { id: slotId, counsellorId },
      include: { bookings: true },
    });
    if (!slot) throw new AppError('NOT_FOUND', 'Availability slot not found', 404);
    if (slot.bookings.some(({ status }) => status !== 'CANCELLED')) {
      throw new AppError('CONFLICT', 'Booked slots cannot be deleted', 409);
    }
    await this.dbClient.availabilitySlot.delete({ where: { id: slotId } });
  }

  async createBooking({ studentId, slotId, note }) {
    try {
      return await this.dbClient.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`
          UPDATE availability_slots
          SET status = 'BOOKED'
          WHERE id = ${slotId}::uuid AND status = 'AVAILABLE'
        `;
        if (updated !== 1) throw new AppError('CONFLICT', 'Slot is unavailable', 409, [{ field: 'slotId', issue: 'SLOT_UNAVAILABLE' }]);
        const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });
        if (!slot || slot.startsAt <= new Date()) {
          throw new AppError('CONFLICT', 'Slot is unavailable', 409);
        }
        const booking = await tx.booking.create({
          data: { studentId, counsellorId: slot.counsellorId, slotId, note },
          include: { slot: true },
        });
        await tx.emailOutbox.create({
          data: {
            eventType: 'BOOKING_CREATED',
            payload: { bookingId: booking.id, studentId, counsellorId: slot.counsellorId },
            idempotencyKey: booking.id,
          },
        });
        return mapBooking(booking);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('CONFLICT', 'Slot is unavailable', 409);
      throw error;
    }
  }

  async listBookings({ userId, role, page: pageNumber, limit, status, sort = 'createdAt', order = 'desc' } = {}) {
    const pagination = page({ page: pageNumber, limit });
    const where = {
      ...(role === 'STUDENT' ? { studentId: userId } : { counsellorId: userId }),
      ...(status ? { status } : {}),
    };
    const [bookings, total] = await Promise.all([
      this.dbClient.booking.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        include: { slot: true },
      }),
      this.dbClient.booking.count({ where }),
    ]);
    return { data: bookings.map(mapBooking), meta: metadata({ ...pagination, total }) };
  }

  async getBooking({ bookingId, userId, role }) {
    const booking = await this.dbClient.booking.findFirst({
      where: { id: bookingId, ...(role === 'STUDENT' ? { studentId: userId } : { counsellorId: userId }) },
      include: { slot: true },
    });
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);
    return mapBooking(booking);
  }

  async updateBookingStatus({ bookingId, userId, role, status }) {
    return this.dbClient.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, ...(role === 'STUDENT' ? { studentId: userId } : { counsellorId: userId }) },
        include: { slot: true },
      });
      if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);
      const permitted =
        (role === 'STUDENT' && booking.status === 'CONFIRMED' && status === 'CANCELLED') ||
        (role === 'COUNSELLOR' && booking.status === 'CONFIRMED' && ['COMPLETED', 'CANCELLED'].includes(status));
      if (!permitted) throw new AppError('CONFLICT', 'Invalid booking status transition', 409);
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status },
        include: { slot: true },
      });
      if (status === 'CANCELLED') {
        await tx.availabilitySlot.update({ where: { id: booking.slotId }, data: { status: 'AVAILABLE' } });
      }
      return mapBooking(updated);
    });
  }

  async overviewAnalytics({ from, to } = {}) {
    const dateFilter = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const [users, attempts, completedAttempts, bookings, careers] = await Promise.all([
      this.dbClient.user.count({ where: dateFilter }),
      this.dbClient.assessmentAttempt.count({ where: dateFilter }),
      this.dbClient.assessmentAttempt.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
      this.dbClient.booking.count({ where: dateFilter }),
      this.dbClient.career.count({ where: { published: true } }),
    ]);
    return { users, attempts, completedAttempts, bookings, publishedCareers: careers };
  }

  async careerInterestAnalytics({ page: pageNumber, limit } = {}) {
    const pagination = page({ page: pageNumber, limit });
    const rows = await this.dbClient.assessmentAttempt.findMany({
      where: { status: 'COMPLETED', scoresJson: { not: null } },
      select: { scoresJson: true },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
    const totals = {};
    for (const row of rows) {
      for (const [dimension, value] of Object.entries(row.scoresJson || {})) {
        totals[dimension] = (totals[dimension] || 0) + Number(value);
      }
    }
    return { data: Object.entries(totals).map(([dimension, total]) => ({ dimension, total })), meta: metadata({ ...pagination, total: rows.length }) };
  }
}
