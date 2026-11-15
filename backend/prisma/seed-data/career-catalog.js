/**
 * ============================================================================
 * CareerCompass — Career Catalogue Seed Data
 * ============================================================================
 * Authoritative seed dataset defining 12 comprehensive career profiles.
 * Aligned with docs/architecture.md §7, docs/api-contract.md §5 & §6,
 * and docs/data-model.md §2.9, §2.10, §2.11, §2.12 & §4.3.
 *
 * Core Specifications:
 * 1. 12 diverse, representative careers covering varied interest profiles
 * 2. Every career has all 6 canonical dimensions with non-zero weights:
 *    ANALYTICAL, CREATIVE, SOCIAL, PRACTICAL, ORGANIZATIONAL, INVESTIGATIVE
 * 3. All seeded profiles have published = true
 * 4. Realistic skills linked via career_skills
 * 5. Multi-stage education pathways (Secondary, Undergraduate, Postgraduate)
 * 6. Fully idempotent upserting preserving all existing data
 * ============================================================================
 */

export const CAREER_CATALOG = Object.freeze([
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    slug: 'software-architect',
    title: 'Software Architect',
    description:
      'Designs high-level software system architectures, establishes technical frameworks, and guides engineering teams on scalable, secure distributed systems.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Technology & Computing',
    dimensions: {
      ANALYTICAL: 0.95,
      INVESTIGATIVE: 0.85,
      PRACTICAL: 0.65,
      CREATIVE: 0.45,
      ORGANIZATIONAL: 0.40,
      SOCIAL: 0.25,
    },
    skills: ['Software Architecture', 'System Design', 'Cloud Computing', 'Distributed Systems'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (PCM / Computer Science)',
        notes: 'CBSE / ICSE / State Board with Physics, Chemistry, and Mathematics focus.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Tech / B.E. in Computer Science or Software Engineering',
        notes: 'National / State engineering entrance examinations (e.g. JEE Main, Advanced).',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Tech / M.S. in Computer Science or Distributed Systems',
        notes: 'GATE / GRE / University admissions for specialized advanced computing.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    slug: 'data-scientist',
    title: 'Data Scientist',
    description:
      'Develops statistical models, machine learning algorithms, and predictive systems to solve complex analytical problems from high-dimensional datasets.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Applied Analytics',
    dimensions: {
      ANALYTICAL: 0.90,
      INVESTIGATIVE: 0.85,
      ORGANIZATIONAL: 0.60,
      PRACTICAL: 0.50,
      CREATIVE: 0.40,
      SOCIAL: 0.30,
    },
    skills: ['Machine Learning', 'Python', 'Statistical Modeling', 'Data Visualization'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Mathematics & Statistics)',
        notes: 'Strong foundation in calculus, algebra, and applied probability.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Sc / B.Tech in Mathematics, Statistics, or Computer Science',
        notes: 'Core quantitative grounding and foundational programming.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Sc / M.Tech in Data Science or Artificial Intelligence',
        notes: 'Specialization in deep learning, statistical inference, and big data engineering.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    slug: 'ux-researcher',
    title: 'UX Researcher',
    description:
      'Investigates user behavior, cognitive ergonomics, and emotional journeys through qualitative and quantitative research methodologies to inform product design.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Human Factors & Design',
    dimensions: {
      SOCIAL: 0.90,
      INVESTIGATIVE: 0.80,
      CREATIVE: 0.75,
      ANALYTICAL: 0.50,
      ORGANIZATIONAL: 0.40,
      PRACTICAL: 0.30,
    },
    skills: ['User Research', 'Usability Testing', 'Qualitative Analysis', 'Persona Mapping'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Humanities, Psychology or Science)',
        notes: 'Focus on social sciences, behavioral psychology, or visual communication.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Des / B.A. in Psychology, Design, or Human-Computer Interaction',
        notes: 'Design entrance exams (UCEED, NID DAT) or university psychology admissions.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Des / M.S. in Human-Computer Interaction',
        notes: 'Advanced human factors, cognitive psychology, and empirical research methods.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000004',
    slug: 'product-designer',
    title: 'Product Designer',
    description:
      'Blends user interface workflows, design systems, and aesthetic craft to create cohesive, intuitive digital and interactive product experiences.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Interactive Design',
    dimensions: {
      CREATIVE: 0.95,
      PRACTICAL: 0.60,
      SOCIAL: 0.55,
      ANALYTICAL: 0.50,
      INVESTIGATIVE: 0.45,
      ORGANIZATIONAL: 0.35,
    },
    skills: ['UI/UX Design', 'Prototyping', 'Design Systems', 'Wireframing'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Any stream with Design aptitude)',
        notes: 'Portfolio preparation in drawing, composition, and visual thinking.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Des in Industrial Design, Interaction Design, or Visual Communication',
        notes: 'Admissions through UCEED, NID, or institutional design aptitude tests.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Des in Interaction Design or New Media Design',
        notes: 'Specialization in responsive digital products and advanced prototyping.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000005',
    slug: 'biomedical-researcher',
    title: 'Biomedical Researcher',
    description:
      'Conducts laboratory experiments, clinical trials, and molecular investigations to discover novel therapeutic solutions and diagnostic technologies.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Life Sciences',
    dimensions: {
      INVESTIGATIVE: 0.95,
      ANALYTICAL: 0.85,
      PRACTICAL: 0.70,
      ORGANIZATIONAL: 0.50,
      SOCIAL: 0.30,
      CREATIVE: 0.30,
    },
    skills: ['Clinical Research', 'Molecular Biology', 'Laboratory Techniques', 'Data Analysis'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (PCB — Physics, Chemistry, Biology)',
        notes: 'Emphasis on biological sciences, organic chemistry, and laboratory work.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Sc / B.Tech in Biotechnology or Biomedical Sciences',
        notes: 'University entrance tests or engineering biotechnology admissions.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Sc / Ph.D. in Biomedical Sciences or Molecular Medicine',
        notes: 'Rigorous research thesis, peer-reviewed publications, and clinical internships.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000006',
    slug: 'financial-analyst',
    title: 'Financial Analyst',
    description:
      'Evaluates corporate balance sheets, capital market conditions, and economic indicators to build valuation forecasts and guide strategic investments.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Finance & Economics',
    dimensions: {
      ANALYTICAL: 0.90,
      ORGANIZATIONAL: 0.85,
      INVESTIGATIVE: 0.60,
      PRACTICAL: 0.45,
      SOCIAL: 0.35,
      CREATIVE: 0.20,
    },
    skills: ['Financial Modeling', 'Valuation', 'Equity Research', 'Excel Modeling'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Commerce or Mathematics)',
        notes: 'Accountancy, Business Studies, Economics, and Mathematics.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Com / B.B.A. in Finance or B.Sc in Economics',
        notes: 'Foundations in financial accounting, corporate finance, and macroeconomics.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'MBA in Finance or Chartered Financial Analyst (CFA)',
        notes: 'Advanced portfolio management, risk analytics, and capital market valuation.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000007',
    slug: 'clinical-psychologist',
    title: 'Clinical Psychologist',
    description:
      'Diagnoses and treats cognitive, emotional, and psychological disorders through structured therapeutic interventions and evidence-based assessment.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Healthcare & Mental Health',
    dimensions: {
      SOCIAL: 0.95,
      INVESTIGATIVE: 0.80,
      ANALYTICAL: 0.55,
      CREATIVE: 0.45,
      ORGANIZATIONAL: 0.45,
      PRACTICAL: 0.30,
    },
    skills: ['Psychotherapy', 'Psychological Assessment', 'Empathy', 'Case Formulation'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary with Psychology or Biology',
        notes: 'Exploration of human development, behavior, and social dynamics.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.A. / B.Sc in Psychology',
        notes: 'Core training in developmental, abnormal, and cognitive psychology.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.A. / M.Sc in Clinical Psychology & M.Phil / Psy.D.',
        notes: 'RCI-recognized clinical licensing training and hospital residency.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000008',
    slug: 'civil-structural-engineer',
    title: 'Civil & Structural Engineer',
    description:
      'Plans, designs, and inspects large-scale civil infrastructure, transit systems, bridges, and resilient urban structures.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Civil Infrastructure',
    dimensions: {
      PRACTICAL: 0.95,
      ANALYTICAL: 0.85,
      ORGANIZATIONAL: 0.65,
      INVESTIGATIVE: 0.55,
      CREATIVE: 0.35,
      SOCIAL: 0.30,
    },
    skills: ['Structural Analysis', 'AutoCAD', 'Project Management', 'Site Inspection'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (PCM — Physics, Chemistry, Mathematics)',
        notes: 'Emphasis on mechanics, geometry, and physical sciences.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Tech / B.E. in Civil Engineering',
        notes: 'Admissions via JEE Main / State CETs for structural engineering.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Tech in Structural Engineering or Construction Management',
        notes: 'Specialization in seismic resilience, geotechnics, and infrastructure analytics.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000009',
    slug: 'operations-manager',
    title: 'Operations & Logistics Manager',
    description:
      'Directs organizational logistics, distribution networks, and process optimization to ensure operational efficiency across supply chain ecosystems.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Operations & Management',
    dimensions: {
      ORGANIZATIONAL: 0.95,
      PRACTICAL: 0.70,
      SOCIAL: 0.65,
      ANALYTICAL: 0.60,
      INVESTIGATIVE: 0.40,
      CREATIVE: 0.25,
    },
    skills: ['Supply Chain Management', 'Process Optimization', 'Operations Scheduling', 'Resource Allocation'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Commerce, Science, or Arts)',
        notes: 'Business organization, mathematics, and communicative English.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.B.A. / B.Com / B.Tech in Industrial Engineering',
        notes: 'Quantitative operations methods, business law, and logistics management.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'MBA in Operations or Supply Chain Management',
        notes: 'Strategic procurement, enterprise ERP management, and lean Six Sigma.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000010',
    slug: 'stem-educator',
    title: 'Secondary School STEM Educator',
    description:
      'Instructs secondary students in scientific inquiry, computational logic, and mathematics while creating collaborative classroom environments.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Education & Pedagogy',
    dimensions: {
      SOCIAL: 0.90,
      ORGANIZATIONAL: 0.70,
      ANALYTICAL: 0.65,
      INVESTIGATIVE: 0.60,
      CREATIVE: 0.55,
      PRACTICAL: 0.40,
    },
    skills: ['Pedagogical Design', 'Science Communication', 'Classroom Management', 'Curriculum Planning'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Science Stream)',
        notes: 'Broad foundational competence across mathematics and experimental science.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Sc in Physics, Chemistry, or Mathematics',
        notes: 'In-depth conceptual subject mastery in fundamental sciences.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'B.Ed / M.Sc with Teacher Eligibility Qualification (CTET)',
        notes: 'Instructional design, child psychology, and pedagogical evaluation.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000011',
    slug: 'cybersecurity-engineer',
    title: 'Cybersecurity Operations Engineer',
    description:
      'Protects critical network perimeters, detects unauthorized intrusions, investigates security incidents, and performs vulnerability assessments.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Information Security',
    dimensions: {
      INVESTIGATIVE: 0.90,
      ANALYTICAL: 0.85,
      PRACTICAL: 0.80,
      ORGANIZATIONAL: 0.55,
      SOCIAL: 0.25,
      CREATIVE: 0.30,
    },
    skills: ['Network Security', 'Incident Response', 'Penetration Testing', 'Threat Intelligence'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (PCM / Computer Science)',
        notes: 'Networking basics, discrete mathematics, and computer fundamentals.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Tech / B.Sc in Information Technology or Cybersecurity',
        notes: 'Network protocols, cryptography fundamentals, and operating systems.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Tech in Information Security / Certified Professional (CISSP / CEH)',
        notes: 'Advanced malware reverse engineering, digital forensics, and cloud defense.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
  {
    id: 'c0000000-0000-4000-8000-000000000012',
    slug: 'environmental-consultant',
    title: 'Environmental Policy Consultant',
    description:
      'Evaluates environmental sustainability impacts, conducts field assessments, and advises regulatory bodies on climate mitigation strategies.',
    published: true,
    profileVersion: 1,
    sourceNote: 'Authoritative CareerCompass Reference Seed — Environmental Science',
    dimensions: {
      INVESTIGATIVE: 0.85,
      SOCIAL: 0.75,
      ANALYTICAL: 0.70,
      ORGANIZATIONAL: 0.60,
      CREATIVE: 0.45,
      PRACTICAL: 0.40,
    },
    skills: ['Environmental Impact Assessment', 'Policy Analysis', 'Stakeholder Engagement', 'Sustainability Strategy'],
    pathways: [
      {
        stage: 'Secondary',
        qualification: 'Higher Secondary (Science or Humanities with Geography)',
        notes: 'Ecological awareness, environmental studies, and social sciences.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Undergraduate',
        qualification: 'B.Sc / B.A. in Environmental Science, Ecology, or Earth Sciences',
        notes: 'Natural resource management, climatology, and geographic information systems.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
      {
        stage: 'Postgraduate',
        qualification: 'M.Sc in Environmental Management or Public Policy',
        notes: 'Regulatory environmental compliance, carbon accounting, and impact mitigation.',
        verifiedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ],
  },
]);

/**
 * Idempotently seeds the career catalogue into the database.
 * Preserves all existing users, attempts, answers, and data.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {object} [options={}]
 * @param {Array<object>} [options.catalog=CAREER_CATALOG]
 * @returns {Promise<{ action: 'SEEDED', careerCount: number, skillsCount: number }>}
 */
export async function seedCareerCatalog(prismaClient, { catalog = CAREER_CATALOG } = {}) {
  if (!prismaClient || typeof prismaClient.$transaction !== 'function') {
    throw new Error('seedCareerCatalog requires an authoritative PrismaClient instance');
  }

  return await prismaClient.$transaction(async (tx) => {
    // 1. Collect all distinct skills
    const skillSet = new Set();
    for (const career of catalog) {
      for (const skill of career.skills) {
        skillSet.add(skill);
      }
    }

    // 2. Upsert all skills and build name -> id map
    const skillMap = new Map();
    for (const skillName of skillSet) {
      const record = await tx.skill.upsert({
        where: { name: skillName },
        create: { name: skillName },
        update: {},
      });
      skillMap.set(skillName, record.id);
    }

    // 3. Upsert each career profile, its dimensions, skills, and pathways
    for (const c of catalog) {
      const careerRecord = await tx.career.upsert({
        where: { slug: c.slug },
        create: {
          id: c.id,
          slug: c.slug,
          title: c.title,
          description: c.description,
          published: true,
          profileVersion: c.profileVersion,
          sourceNote: c.sourceNote,
        },
        update: {
          title: c.title,
          description: c.description,
          published: true,
          profileVersion: c.profileVersion,
          sourceNote: c.sourceNote,
        },
      });

      // Upsert the 6 canonical dimensions
      for (const [dim, weight] of Object.entries(c.dimensions)) {
        await tx.careerDimension.upsert({
          where: {
            careerId_dimension: {
              careerId: careerRecord.id,
              dimension: dim,
            },
          },
          create: {
            careerId: careerRecord.id,
            dimension: dim,
            targetWeight: weight,
          },
          update: {
            targetWeight: weight,
          },
        });
      }

      // Link skills
      for (const skillName of c.skills) {
        const skillId = skillMap.get(skillName);
        if (skillId) {
          await tx.careerSkill.upsert({
            where: {
              careerId_skillId: {
                careerId: careerRecord.id,
                skillId,
              },
            },
            create: {
              careerId: careerRecord.id,
              skillId,
            },
            update: {},
          });
        }
      }

      // Sync pathways (reconcile child collection safely for this career)
      await tx.educationPathway.deleteMany({
        where: { careerId: careerRecord.id },
      });

      if (c.pathways && c.pathways.length > 0) {
        await tx.educationPathway.createMany({
          data: c.pathways.map((p) => ({
            careerId: careerRecord.id,
            stage: p.stage,
            qualification: p.qualification,
            notes: p.notes,
            verifiedAt: p.verifiedAt,
          })),
        });
      }
    }

    return {
      action: 'SEEDED',
      careerCount: catalog.length,
      skillsCount: skillSet.size,
    };
  });
}

export default seedCareerCatalog;
