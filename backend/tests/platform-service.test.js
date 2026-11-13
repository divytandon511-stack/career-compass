import { describe, expect, it, vi } from 'vitest';
import { PlatformService } from '../src/services/platform.service.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'STUDENT',
};

describe('PlatformService', () => {
  it('rejects invalid admin pagination and filters', async () => {
    const repository = { listUsers: vi.fn() };
    const service = new PlatformService({ repository });

    expect(() => service.listUsers({ page: '0', limit: '100' }))
      .toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(repository.listUsers).not.toHaveBeenCalled();
  });

  it('prevents non-students from changing school grade', () => {
    const service = new PlatformService({ repository: { updateUser: vi.fn() } });

    expect(() => service.updateUser({
      user: { ...user, role: 'COUNSELLOR' },
      body: { schoolGrade: '12' },
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('validates assessment question definitions before persistence', async () => {
    const repository = { createQuestion: vi.fn() };
    const service = new PlatformService({ repository });

    expect(() => service.createQuestion({
      assessmentId: user.id,
      body: {
        prompt: 'Question',
        dimension: 'ANALYTICAL',
        weight: 1,
        position: 1,
        options: [{ id: 'only', label: 'Only', value: 1 }],
      },
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(repository.createQuestion).not.toHaveBeenCalled();
  });

  it('passes authenticated ownership to booking queries', async () => {
    const repository = { listBookings: vi.fn().mockResolvedValue({ data: [], meta: {} }) };
    const service = new PlatformService({ repository });

    await service.listBookings({ user, query: {} });

    expect(repository.listBookings).toHaveBeenCalledWith(expect.objectContaining({
      userId: user.id,
      role: 'STUDENT',
      page: 1,
      limit: 20,
    }));
  });

  it('validates booking status transitions at the service boundary', async () => {
    const repository = { updateBookingStatus: vi.fn() };
    const service = new PlatformService({ repository });

    expect(() => service.updateBookingStatus({
      user,
      bookingId: user.id,
      body: { status: 'CONFIRMED' },
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(repository.updateBookingStatus).not.toHaveBeenCalled();
  });
});
