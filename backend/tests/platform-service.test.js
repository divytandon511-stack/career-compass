import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PlatformService } from '../src/services/platform.service.js';
import { PlatformRepository } from '../src/repositories/platform.repository.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'STUDENT',
};

describe('PlatformService', () => {
  it('serves the counsellor directory to guests without exposing contact email', async () => {
    const authenticate = vi.fn((req, res, next) => next());
    const platformService = {
      listCounsellors: vi.fn().mockResolvedValue({
        data: [{ id: user.id, displayName: 'Asha Rao', bio: 'Science stream guidance' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };
    const app = createApp({ platformService, authenticate, allowedOrigins: [] });

    const response = await request(app).get('/api/v1/counsellors');

    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ id: user.id, displayName: 'Asha Rao' });
    expect(response.body.data[0]).not.toHaveProperty('email');
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('searches active counsellors by name or guidance bio', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      userId: user.id,
      displayName: 'Asha Rao',
      bio: 'Science stream guidance',
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { email: 'private@example.com' },
    }]);
    const count = vi.fn().mockResolvedValue(1);
    const repository = new PlatformRepository({
      dbClient: { counsellorProfile: { findMany, count } },
    });

    const result = await repository.listCounsellors({ q: 'science' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        active: true,
        user: { is: { status: 'ACTIVE' } },
        OR: [
          { displayName: { contains: 'science', mode: 'insensitive' } },
          { bio: { contains: 'science', mode: 'insensitive' } },
        ],
      },
    }));
    expect(result.data[0]).not.toHaveProperty('email');
  });

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
