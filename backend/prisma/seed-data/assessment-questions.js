/**
 * ============================================================================
 * CareerCompass — Assessment & Questions Seed Data
 * ============================================================================
 * Authoritative seed dataset defining the published 30-question interest assessment.
 * Aligned with docs/architecture.md §7, docs/api-contract.md §3 & §5,
 * and docs/data-model.md §2.5, §2.6 & §4.3.
 *
 * Core Specifications:
 * 1. Single published assessment: "Career Interest Explorer v1"
 * 2. Exactly 30 questions distributed across the 6 canonical dimensions (5 questions each):
 *    - ANALYTICAL (Positions 1–5)
 *    - CREATIVE (Positions 6–10)
 *    - SOCIAL (Positions 11–15)
 *    - PRACTICAL (Positions 16–20)
 *    - ORGANIZATIONAL (Positions 21–25)
 *    - INVESTIGATIVE (Positions 26–30)
 * 3. Suitable for Indian secondary & higher secondary students (Grades 9–12)
 * 4. Deterministic UUIDs ensuring idempotent re-seeding without duplicate keys
 * 5. Standard 5-point Likert options (0 = Strongly Disagree to 4 = Strongly Agree)
 * ============================================================================
 */

export const ASSESSMENT_ID = 'a0000000-0000-4000-8000-000000000001';

export const DEFAULT_ASSESSMENT = Object.freeze({
  id: ASSESSMENT_ID,
  title: 'Career Interest Explorer v1',
  description:
    'Standard 30-question career interest assessment for secondary and higher secondary students (Grades 9-12), evaluating six core dimensions: Analytical, Creative, Social, Practical, Organizational, and Investigative.',
  version: 1,
  status: 'PUBLISHED',
});

/**
 * Standard 5-point Likert response scale.
 * Stored server-side in Question JSONB. Values (0..4) are strictly server-side
 * and never exposed directly in student-facing questionnaires.
 */
export const LIKERT_OPTIONS_TEMPLATE = Object.freeze([
  { value: 0, label: 'Strongly Disagree' },
  { value: 1, label: 'Disagree' },
  { value: 2, label: 'Neutral' },
  { value: 3, label: 'Agree' },
  { value: 4, label: 'Strongly Agree' },
]);

/**
 * Deterministically derives a valid RFC 4122 v4-formatted UUID for a question position (1..30).
 *
 * @param {number} position - Question position integer between 1 and 30
 * @returns {string} 36-character lowercase UUID
 */
export const generateQuestionId = (position) => {
  return `b0000000-0000-4000-8000-${String(position).padStart(12, '0')}`;
};

/**
 * Deterministically derives a valid RFC 4122 v4-formatted UUID for an option ID.
 *
 * @param {number} position - Question position integer between 1 and 30
 * @param {number} value - Option score value integer between 0 and 4
 * @returns {string} 36-character lowercase UUID
 */
export const generateOptionId = (position, value) => {
  return `c0000000-${String(position).padStart(4, '0')}-4000-8000-${String(value).padStart(12, '0')}`;
};

/**
 * Constructs deterministic options array for a given question position.
 *
 * @param {number} position
 * @returns {Array<{ id: string, label: string, value: number }>}
 */
export const buildOptionsForPosition = (position) => {
  return LIKERT_OPTIONS_TEMPLATE.map((tpl) => ({
    id: generateOptionId(position, tpl.value),
    label: tpl.label,
    value: tpl.value,
  }));
};

/**
 * Raw definitions for all 30 assessment questions.
 * Prompts are contextualized for Indian students in Grades 9–12 (CBSE/ICSE/State boards).
 */
const QUESTION_DEFINITIONS = [
  // --------------------------------------------------------------------------
  // Dimension 1: ANALYTICAL (Positions 1–5)
  // --------------------------------------------------------------------------
  {
    position: 1,
    dimension: 'ANALYTICAL',
    prompt: 'I enjoy solving complex mathematical puzzles and finding patterns in numbers or logic games.',
  },
  {
    position: 2,
    dimension: 'ANALYTICAL',
    prompt: 'I like analyzing charts, tables, and statistical trends to draw logical conclusions in science or economics projects.',
  },
  {
    position: 3,
    dimension: 'ANALYTICAL',
    prompt: 'I prefer breaking down a complicated problem into step-by-step algorithms or flowcharts before writing code or solving it.',
  },
  {
    position: 4,
    dimension: 'ANALYTICAL',
    prompt: 'I enjoy comparing different financial choices, budgets, or costs to identify the most economical solution for a school event.',
  },
  {
    position: 5,
    dimension: 'ANALYTICAL',
    prompt: 'I like using systematic methods and probability to evaluate strategies in board games, quizzes, or project planning.',
  },

  // --------------------------------------------------------------------------
  // Dimension 2: CREATIVE (Positions 6–10)
  // --------------------------------------------------------------------------
  {
    position: 6,
    dimension: 'CREATIVE',
    prompt: 'I enjoy designing visual graphics, posters, or digital banners for school clubs and cultural fests.',
  },
  {
    position: 7,
    dimension: 'CREATIVE',
    prompt: 'I like writing original stories, poems, scripts, or articles for the school magazine or creative writing contests.',
  },
  {
    position: 8,
    dimension: 'CREATIVE',
    prompt: 'I enjoy composing tunes, editing videos, or creating multimedia presentations that convey emotions and ideas.',
  },
  {
    position: 9,
    dimension: 'CREATIVE',
    prompt: 'I prefer developing innovative, out-of-the-box concepts rather than following conventional methods when given a creative assignment.',
  },
  {
    position: 10,
    dimension: 'CREATIVE',
    prompt: 'I like experimenting with artistic mediums like sketching, photography, or digital illustration to express personal viewpoints.',
  },

  // --------------------------------------------------------------------------
  // Dimension 3: SOCIAL (Positions 11–15)
  // --------------------------------------------------------------------------
  {
    position: 11,
    dimension: 'SOCIAL',
    prompt: 'I find it fulfilling to tutor classmates or junior students when they struggle to understand a difficult academic topic.',
  },
  {
    position: 12,
    dimension: 'SOCIAL',
    prompt: 'I am comfortable mediating disagreements among peers and helping them find a peaceful, mutually agreeable resolution.',
  },
  {
    position: 13,
    dimension: 'SOCIAL',
    prompt: 'I enjoy participating in community service campaigns, social welfare drives, or environmental awareness programs in my neighbourhood.',
  },
  {
    position: 14,
    dimension: 'SOCIAL',
    prompt: 'I listen attentively when friends share their personal worries and offer compassionate encouragement to support them.',
  },
  {
    position: 15,
    dimension: 'SOCIAL',
    prompt: 'I like collaborating in team activities and making sure every group member feels included and heard.',
  },

  // --------------------------------------------------------------------------
  // Dimension 4: PRACTICAL (Positions 16–20)
  // --------------------------------------------------------------------------
  {
    position: 16,
    dimension: 'PRACTICAL',
    prompt: 'I enjoy assembling electronic kits, robotics components, or repairing household appliances using hand tools.',
  },
  {
    position: 17,
    dimension: 'PRACTICAL',
    prompt: 'I like constructing physical working models or prototypes using materials like wood, cardboard, or 3D printers for exhibitions.',
  },
  {
    position: 18,
    dimension: 'PRACTICAL',
    prompt: 'I prefer hands-on fieldwork like gardening, soil testing, or plant cultivation over purely theoretical classroom study.',
  },
  {
    position: 19,
    dimension: 'PRACTICAL',
    prompt: 'I like troubleshooting mechanical problems in bicycles, motor parts, or lab equipment to figure out why they stopped working.',
  },
  {
    position: 20,
    dimension: 'PRACTICAL',
    prompt: 'I enjoy operating scientific apparatus, measurement gauges, and physical workshop machinery safely to test material properties.',
  },

  // --------------------------------------------------------------------------
  // Dimension 5: ORGANIZATIONAL (Positions 21–25)
  // --------------------------------------------------------------------------
  {
    position: 21,
    dimension: 'ORGANIZATIONAL',
    prompt: 'I like creating detailed checklists, timetables, and project plans to ensure my study schedule or group tasks stay on track.',
  },
  {
    position: 22,
    dimension: 'ORGANIZATIONAL',
    prompt: 'I enjoy coordinating logistics, participant registrations, and seating arrangements for school events or sports meets.',
  },
  {
    position: 23,
    dimension: 'ORGANIZATIONAL',
    prompt: 'I take pride in maintaining neat, well-structured digital folders, study notes, and cataloged resource materials.',
  },
  {
    position: 24,
    dimension: 'ORGANIZATIONAL',
    prompt: 'I like keeping track of committee funds, item receipts, and inventory records for school clubs or class activities.',
  },
  {
    position: 25,
    dimension: 'ORGANIZATIONAL',
    prompt: 'I prefer following clear procedures, safety guidelines, and established quality standards when completing assignments.',
  },

  // --------------------------------------------------------------------------
  // Dimension 6: INVESTIGATIVE (Positions 26–30)
  // --------------------------------------------------------------------------
  {
    position: 26,
    dimension: 'INVESTIGATIVE',
    prompt: 'I enjoy designing scientific experiments, formulating hypotheses, and testing them systematically in a chemistry or physics lab.',
  },
  {
    position: 27,
    dimension: 'INVESTIGATIVE',
    prompt: 'I like reading research articles, encyclopedias, or science journals to explore how natural phenomena or technologies function.',
  },
  {
    position: 28,
    dimension: 'INVESTIGATIVE',
    prompt: 'I enjoy examining microscopic specimens, rock samples, or biological cultures to observe details not visible to the naked eye.',
  },
  {
    position: 29,
    dimension: 'INVESTIGATIVE',
    prompt: 'I like digging into complex questions to discover the root cause of an unexpected result or anomaly in an experiment.',
  },
  {
    position: 30,
    dimension: 'INVESTIGATIVE',
    prompt: 'I am fascinated by space exploration, planetary data, and astronomical discoveries and enjoy studying cosmic observations.',
  },
];

/**
 * Complete, frozen array of 30 question objects ready for Prisma insertion.
 */
export const ASSESSMENT_QUESTIONS = Object.freeze(
  QUESTION_DEFINITIONS.map((def) =>
    Object.freeze({
      id: generateQuestionId(def.position),
      position: def.position,
      dimension: def.dimension,
      prompt: def.prompt,
      weight: 1.0,
      options: Object.freeze(buildOptionsForPosition(def.position)),
    })
  )
);
