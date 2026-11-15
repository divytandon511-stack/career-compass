import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { CareerService } from '../src/services/career.service.js';
import { CareerRepositoryAdapter } from '../src/repositories/career.repository.adapter.js';

/**
 * Creates an in-memory dbClient implementing the Prisma career and skill query interface.
 */
const createMockDbClient = () => {
  // 12 Published careers
  const careers = [
    { id: 'c-01', slug: 'software-architect', title: 'Software Architect', description: 'Distributed systems and cloud software architecture.', published: true, profileVersion: 1, createdAt: new Date('2026-01-01') },
    { id: 'c-02', slug: 'ux-researcher', title: 'UX Researcher', description: 'User research and usability testing.', published: true, profileVersion: 1, createdAt: new Date('2026-01-02') },
    { id: 'c-03', slug: 'data-scientist', title: 'Data Scientist', description: 'Machine learning, statistics, and predictive modeling.', published: true, profileVersion: 1, createdAt: new Date('2026-01-03') },
    { id: 'c-04', slug: 'product-designer', title: 'Product Designer', description: 'UI/UX interface design and design systems.', published: true, profileVersion: 1, createdAt: new Date('2026-01-04') },
    { id: 'c-05', slug: 'biomedical-researcher', title: 'Biomedical Researcher', description: 'Clinical research and molecular biology investigations.', published: true, profileVersion: 1, createdAt: new Date('2026-01-05') },
    { id: 'c-06', slug: 'financial-analyst', title: 'Financial Analyst', description: 'Financial modeling and valuation analytics.', published: true, profileVersion: 1, createdAt: new Date('2026-01-06') },
    { id: 'c-07', slug: 'clinical-psychologist', title: 'Clinical Psychologist', description: 'Psychotherapy and psychological assessment.', published: true, profileVersion: 1, createdAt: new Date('2026-01-07') },
    { id: 'c-08', slug: 'civil-structural-engineer', title: 'Civil & Structural Engineer', description: 'Infrastructure design and structural analysis.', published: true, profileVersion: 1, createdAt: new Date('2026-01-08') },
    { id: 'c-09', slug: 'operations-manager', title: 'Operations & Logistics Manager', description: 'Process optimization and supply chain management.', published: true, profileVersion: 1, createdAt: new Date('2026-01-09') },
    { id: 'c-10', slug: 'stem-educator', title: 'Secondary School STEM Educator', description: 'Science communication and pedagogy.', published: true, profileVersion: 1, createdAt: new Date('2026-01-10') },
    { id: 'c-11', slug: 'cybersecurity-engineer', title: 'Cybersecurity Operations Engineer', description: 'Network security and penetration testing.', published: true, profileVersion: 1, createdAt: new Date('2026-01-11') },
    { id: 'c-12', slug: 'environmental-consultant', title: 'Environmental Policy Consultant', description: 'Environmental impact assessment and sustainability.', published: true, profileVersion: 1, createdAt: new Date('2026-01-12') },
    // 1 Unpublished draft career
    { id: 'c-99', slug: 'draft-career', title: 'Draft Career', description: 'Unpublished draft career profile.', published: false, profileVersion: 1, createdAt: new Date('2026-01-13') },
  ];

  // Standardized skills (with UUIDs)
  const skills = [
    { id: '11111111-0000-4000-8000-000000000001', name: 'Python' },
    { id: '11111111-0000-4000-8000-000000000002', name: 'Data Analysis' },
    { id: '11111111-0000-4000-8000-000000000003', name: 'Project Management' },
    { id: '11111111-0000-4000-8000-000000000004', name: 'AutoCAD' },
    { id: '11111111-0000-4000-8000-000000000005', name: 'Statistical Modeling' },
  ];

  // Many-to-many career_skills mappings
  const careerSkills = [
    // Python (linked to 3 published careers + 1 draft career)
    { careerId: 'c-03', skillId: '11111111-0000-4000-8000-000000000001' }, // Data Scientist
    { careerId: 'c-01', skillId: '11111111-0000-4000-8000-000000000001' }, // Software Architect
    { careerId: 'c-11', skillId: '11111111-0000-4000-8000-000000000001' }, // Cybersecurity Operations Engineer
    { careerId: 'c-99', skillId: '11111111-0000-4000-8000-000000000001' }, // Draft Career (unpublished)

    // Data Analysis (linked to 6 published careers)
    { careerId: 'c-05', skillId: '11111111-0000-4000-8000-000000000002' },
    { careerId: 'c-03', skillId: '11111111-0000-4000-8000-000000000002' },
    { careerId: 'c-02', skillId: '11111111-0000-4000-8000-000000000002' },
    { careerId: 'c-06', skillId: '11111111-0000-4000-8000-000000000002' },
    { careerId: 'c-09', skillId: '11111111-0000-4000-8000-000000000002' },
    { careerId: 'c-12', skillId: '11111111-0000-4000-8000-000000000002' },

    // Project Management (linked to 5 published careers)
    { careerId: 'c-08', skillId: '11111111-0000-4000-8000-000000000003' },
    { careerId: 'c-01', skillId: '11111111-0000-4000-8000-000000000003' },
    { careerId: 'c-09', skillId: '11111111-0000-4000-8000-000000000003' },
    { careerId: 'c-10', skillId: '11111111-0000-4000-8000-000000000003' },
    { careerId: 'c-12', skillId: '11111111-0000-4000-8000-000000000003' },

    // AutoCAD (linked to 1 published career)
    { careerId: 'c-08', skillId: '11111111-0000-4000-8000-000000000004' },

    // Statistical Modeling (linked to 3 published careers)
    { careerId: 'c-03', skillId: '11111111-0000-4000-8000-000000000005' },
    { careerId: 'c-06', skillId: '11111111-0000-4000-8000-000000000005' },
    { careerId: 'c-05', skillId: '11111111-0000-4000-8000-000000000005' },
  ];

  const matchesWhere = (c, where = {}) => {
    if (where.published !== undefined && c.published !== where.published) return false;
    if (where.OR) {
      const match = where.OR.some((clause) => {
        if (clause.title?.contains) {
          return c.title.toLowerCase().includes(clause.title.contains.toLowerCase());
        }
        if (clause.description?.contains) {
          return c.description.toLowerCase().includes(clause.description.contains.toLowerCase());
        }
        return false;
      });
      if (!match) return false;
    }
    if (where.careerSkills?.some?.skillId) {
      const targetSkillId = where.careerSkills.some.skillId;
      const hasSkill = careerSkills.some(
        (cs) => cs.careerId === c.id && cs.skillId === targetSkillId
      );
      if (!hasSkill) return false;
    }
    return true;
  };

  return {
    career: {
      async findMany({ where = {}, orderBy = { title: 'asc' }, skip = 0, take = 20 } = {}) {
        let results = careers.filter((c) => matchesWhere(c, where));
        const sortKey = Object.keys(orderBy)[0] || 'title';
        const sortDir = orderBy[sortKey] || 'asc';
        results.sort((a, b) => {
          const valA = a[sortKey];
          const valB = b[sortKey];
          if (valA < valB) return sortDir === 'asc' ? -1 : 1;
          if (valA > valB) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
        return results.slice(skip, skip + take);
      },
      async count({ where = {} } = {}) {
        return careers.filter((c) => matchesWhere(c, where)).length;
      },
      async findFirst({ where = {} } = {}) {
        return careers.find((c) => (where.id ? c.id === where.id : c.slug === where.slug)) || null;
      },
    },
    skill: {
      async findMany({ where = {}, skip = 0, take = 50 } = {}) {
        let res = skills;
        if (where.name?.contains) {
          res = res.filter((s) => s.name.toLowerCase().includes(where.name.contains.toLowerCase()));
        }
        return res.slice(skip, skip + take);
      },
      async count({ where = {} } = {}) {
        return skills.length;
      },
    },
    careerSkill: {
      async count() {
        return careerSkills.length;
      },
    },
  };
};

describe('Career Explorer Skill-Filtering & Taxonomy Regression Tests', () => {
  const dbClient = createMockDbClient();
  const careerRepository = new CareerRepositoryAdapter({ dbClient });
  const careerService = new CareerService({ careerRepository });
  const app = createApp({ careerService, authenticate: (req, res, next) => next() });

  const PYTHON_ID = '11111111-0000-4000-8000-000000000001';
  const DATA_ANALYSIS_ID = '11111111-0000-4000-8000-000000000002';
  const PROJ_MGMT_ID = '11111111-0000-4000-8000-000000000003';
  const AUTOCAD_ID = '11111111-0000-4000-8000-000000000004';
  const UNMATCHED_UUID = '00000000-0000-0000-0000-000000000000';

  it('1. filters careers by transversal skill "Python" returning all 3 published careers', async () => {
    const res = await request(app).get(`/api/v1/careers?skillId=${PYTHON_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    expect(res.body.meta.totalPages).toBe(1);
    expect(res.body.data).toHaveLength(3);

    const titles = res.body.data.map((c) => c.title);
    expect(titles).toContain('Data Scientist');
    expect(titles).toContain('Software Architect');
    expect(titles).toContain('Cybersecurity Operations Engineer');
    // Unpublished draft career must not be exposed to students
    expect(titles).not.toContain('Draft Career');
  });

  it('2. filters careers by transversal skill "Data Analysis" returning 6 published careers', async () => {
    const res = await request(app).get(`/api/v1/careers?skillId=${DATA_ANALYSIS_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(6);
    expect(res.body.data).toHaveLength(6);

    const titles = res.body.data.map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Biomedical Researcher',
        'Data Scientist',
        'Environmental Policy Consultant',
        'Financial Analyst',
        'Operations & Logistics Manager',
        'UX Researcher',
      ])
    );
  });

  it('3. filters careers by transversal skill "Project Management" returning 5 published careers', async () => {
    const res = await request(app).get(`/api/v1/careers?skillId=${PROJ_MGMT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(5);
    expect(res.body.data).toHaveLength(5);

    const titles = res.body.data.map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Civil & Structural Engineer',
        'Environmental Policy Consultant',
        'Operations & Logistics Manager',
        'Secondary School STEM Educator',
        'Software Architect',
      ])
    );
  });

  it('4. filters careers by single-career skill "AutoCAD" returning exactly 1 career', async () => {
    const res = await request(app).get(`/api/v1/careers?skillId=${AUTOCAD_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Civil & Structural Engineer');
  });

  it('5. combines keyword search (q) and skill filter (skillId) using AND logic', async () => {
    // Both Python AND query "Cybersecurity"
    const resMatching = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&q=Cybersecurity`
    );
    expect(resMatching.status).toBe(200);
    expect(resMatching.body.meta.total).toBe(1);
    expect(resMatching.body.data[0].title).toBe('Cybersecurity Operations Engineer');

    // Python AND query that matches a non-Python career -> 0 results
    const resDisjoint = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&q=Psychologist`
    );
    expect(resDisjoint.status).toBe(200);
    expect(resDisjoint.body.meta.total).toBe(0);
    expect(resDisjoint.body.data).toEqual([]);
  });

  it('6. clearing skillId parameter restores all 12 published careers', async () => {
    const res = await request(app).get('/api/v1/careers');

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(12);
    expect(res.body.data).toHaveLength(12);
  });

  it('7. returns HTTP 200 with empty array for valid non-matching UUID', async () => {
    const res = await request(app).get(`/api/v1/careers?skillId=${UNMATCHED_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totalPages).toBe(0);
  });

  it('8. returns HTTP 422 VALIDATION_ERROR for malformed skillId', async () => {
    const res = await request(app).get('/api/v1/careers?skillId=not-a-valid-uuid');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('skillId');
  });

  it('9. supports sorting combined with skillId', async () => {
    const resDesc = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&sort=title&order=desc`
    );
    expect(resDesc.status).toBe(200);
    const titlesDesc = resDesc.body.data.map((c) => c.title);
    expect(titlesDesc).toEqual([
      'Software Architect',
      'Data Scientist',
      'Cybersecurity Operations Engineer',
    ]);

    const resAsc = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&sort=title&order=asc`
    );
    expect(resAsc.status).toBe(200);
    const titlesAsc = resAsc.body.data.map((c) => c.title);
    expect(titlesAsc).toEqual([
      'Cybersecurity Operations Engineer',
      'Data Scientist',
      'Software Architect',
    ]);
  });

  it('10. supports pagination combined with skillId', async () => {
    // Python has 3 published careers; paginate with limit=2
    const page1 = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&page=1&limit=2&sort=title&order=asc`
    );
    expect(page1.status).toBe(200);
    expect(page1.body.meta.page).toBe(1);
    expect(page1.body.meta.limit).toBe(2);
    expect(page1.body.meta.total).toBe(3);
    expect(page1.body.meta.totalPages).toBe(2);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.data.map((c) => c.title)).toEqual([
      'Cybersecurity Operations Engineer',
      'Data Scientist',
    ]);

    const page2 = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&page=2&limit=2&sort=title&order=asc`
    );
    expect(page2.status).toBe(200);
    expect(page2.body.meta.page).toBe(2);
    expect(page2.body.meta.limit).toBe(2);
    expect(page2.body.meta.total).toBe(3);
    expect(page2.body.meta.totalPages).toBe(2);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].title).toBe('Software Architect');

    const page3 = await request(app).get(
      `/api/v1/careers?skillId=${PYTHON_ID}&page=3&limit=2&sort=title&order=asc`
    );
    expect(page3.status).toBe(200);
    expect(page3.body.data).toHaveLength(0);
  });
});

