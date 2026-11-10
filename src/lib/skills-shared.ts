// Client-safe (pure) skills-checklist definitions — types, constants and
// pure helpers only. No database, no xlsx, no server imports: safe to import
// from React components. Server-only code lives in '@/lib/skills'.
// ─── Checklist brand (candidate-facing document, VaultVerify layout) ──
export const CHECKLIST_BRAND = {
  name: 'VaultVerify',
  tagline: 'Honest references. Clearly labeled skills.',
}
export const VALIDITY_DAYS = 30 // checklist valid this many days after completion

// ─── Rating scale (VaultVerify proficiency scale, 1–4) ───────────────
export const SCALE_MAX = 4
export const SCALE_LEGEND: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'No theory / experience', short: 'No theory' },
  { value: 2, label: 'Limited', short: 'Limited' },
  { value: 3, label: 'Experienced', short: 'Experienced' },
  { value: 4, label: 'Proficient', short: 'Proficient' },
]
export function ratingShortLabel(v: number): string {
  return SCALE_LEGEND.find((l) => l.value === v)?.short ?? '—'
}

// ─── Last performed (recency, per rated skill) ──────────────────────
export const LAST_PERFORMED_OPTIONS = [
  { value: '3m', label: 'Within 3 months' },
  { value: '6m', label: 'Within 6 months' },
  { value: '6m+', label: '6+ months ago' },
  { value: 'na', label: 'N/A' },
] as const
export type LastPerformedValue = (typeof LAST_PERFORMED_OPTIONS)[number]['value']
export type LastPerformed = Record<string, LastPerformedValue>
export function lastPerformedLabel(v: LastPerformedValue | undefined | null): string {
  if (!v) return '—'
  return LAST_PERFORMED_OPTIONS.find((o) => o.value === v)?.label ?? '—'
}
export function isRecent(v: LastPerformedValue | undefined | null): boolean {
  return v === '3m' // "Recent means last performed within 3 months."
}

// ─── Additional questions (fixed set, VaultVerify layout) ────────────
export type AdditionalQuestion = {
  id: string
  type: 'yes_no' | 'text'
  text: string
}
export type AdditionalSection = {
  section: string
  questions: AdditionalQuestion[]
}
export const ADDITIONAL_SECTIONS: AdditionalSection[] = [
  {
    section: 'Availability & preferences',
    questions: [
      { id: 'float_units', type: 'yes_no', text: 'Are you willing to float to other units when needed?' },
      { id: 'night_shifts', type: 'yes_no', text: 'Are you comfortable working night shifts?' },
      { id: 'ehr_experience', type: 'yes_no', text: 'Have you worked with an electronic health record (EHR) system?' },
      { id: 'travel_assignments', type: 'yes_no', text: 'Are you open to travel assignments outside your home state?' },
    ],
  },
  {
    section: 'Experience notes',
    questions: [
      { id: 'ehr_systems', type: 'text', text: 'Which EHR systems have you used?' },
      { id: 'extra_notes', type: 'text', text: 'Add any extra certifications, training or notes the recruiter should know about.' },
    ],
  },
]
export const ALL_ADDITIONAL_QUESTIONS: AdditionalQuestion[] = ADDITIONAL_SECTIONS.flatMap((s) => s.questions)

export type AdditionalAnswers = Record<string, 'yes' | 'no' | string>
export type AdditionalData = {
  experienceYears: number | null
  answers: AdditionalAnswers
}

// ─── Candidate attestation texts (VaultVerify) ───────────────────────
export const ATTESTATION = {
  heading: 'Candidate attestation',
  intro: 'Please read and confirm before this checklist is shared.',
  confirm: 'I confirm that the ratings above are my own and reflect my real experience. I understand that inaccurate information may affect my eligibility for placement.',
  agree: 'I agree to the Privacy Policy and Terms of Use.',
}

export const VALID_QUESTION_TYPES = ['rating_1_4', 'yes_no', 'text'] as const
export type QuestionType = (typeof VALID_QUESTION_TYPES)[number]

// ─── Checklist item snapshot (stored on Checklist.itemsJson) ────────
export type SnapshotSkill = {
  name: string
  questionType: string // rating_1_4 | yes_no | text
  hasNaOption: boolean
}
export type SnapshotCategory = { category: string; skills: SnapshotSkill[] }

export type RatingValue = number | 'na' | 'yes' | 'no' | string
export type Ratings = Record<string, RatingValue>

// ─── Template label ─────────────────────────────────────────────────
export function templateLabel(profession: string, jobTitle: string, specialty: string): string {
  return `${profession} | ${jobTitle} | ${specialty}`
}

// ─── Ratings helpers ────────────────────────────────────────────────
export function isAnswered(v: RatingValue | undefined): boolean {
  return v !== undefined && v !== null && v !== ''
}
export function isNumeric(v: RatingValue): v is number {
  return typeof v === 'number'
}

// Average over numeric ratings only (N/A, yes/no and text excluded).
export function computeAvg(ratings: Ratings): number | null {
  const nums = Object.values(ratings).filter(isNumeric)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

// ─── VaultVerify summary ("Summary at a glance" + "Category overview") ─
export type MixRow = { key: string; label: string; count: number; pct: number }
export type CategoryStat = {
  category: string
  total: number
  rated: number
  avg: number | null
  proficient: number
  recent: number
  naCount: number
}
export type ChecklistSummaryStats = {
  skillsAssessed: number // all rating_1_4 skills in the checklist
  ratedCount: number // rating_1_4 skills with a numeric rating (excl. N/A)
  avg: number | null
  ratingMix: MixRow[] // Proficient / Experienced / Limited / No theory
  lastPerformedMix: MixRow[] // Within 3 / Within 6 / 6+ months ago / N/A
  recentPct: number // % of skills last performed within 3 months
  categories: CategoryStat[]
}

export function summarizeChecklist(
  items: SnapshotCategory[],
  ratings: Ratings,
  lastPerformed: LastPerformed | null,
): ChecklistSummaryStats {
  // Rating mix keyed by numeric value 4..1; N/A tracked separately in last-performed mix.
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const lpCounts: Record<LastPerformedValue, number> = { '3m': 0, '6m': 0, '6m+': 0, na: 0 }
  let skillsAssessed = 0
  let ratedCount = 0
  let ratingSum = 0
  const categories: CategoryStat[] = items.map((c) => {
    let catRated = 0
    let catSum = 0
    let proficient = 0
    let recent = 0
    let naCount = 0
    for (const s of c.skills) {
      if (s.questionType !== 'rating_1_4') continue
      skillsAssessed++
      const v = ratings[s.name]
      const lp = lastPerformed?.[s.name]
      if (lp && lp in lpCounts) lpCounts[lp]++
      if (typeof v === 'number') {
        ratingCounts[v] = (ratingCounts[v] ?? 0) + 1
        ratedCount++
        catRated++
        catSum += v
        ratingSum += v
        if (v === 4) proficient++
        if (isRecent(lp)) recent++
      } else if (v === 'na') {
        naCount++
      }
    }
    return {
      category: c.category,
      total: c.skills.filter((s) => s.questionType === 'rating_1_4').length,
      rated: catRated,
      avg: catRated > 0 ? Math.round((catSum / catRated) * 100) / 100 : null,
      proficient,
      recent,
      naCount,
    }
  })

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
  const mixRow = (key: string, label: string, count: number): MixRow => ({ key, label, count, pct: pct(count, skillsAssessed) })

  return {
    skillsAssessed,
    ratedCount,
    avg: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 100) / 100 : null,
    ratingMix: [
      mixRow('4', 'Proficient', ratingCounts[4] ?? 0),
      mixRow('3', 'Experienced', ratingCounts[3] ?? 0),
      mixRow('2', 'Limited', ratingCounts[2] ?? 0),
      mixRow('1', 'No theory', ratingCounts[1] ?? 0),
    ],
    lastPerformedMix: [
      mixRow('3m', 'Within 3 months', lpCounts['3m'] ?? 0),
      mixRow('6m', 'Within 6 months', lpCounts['6m'] ?? 0),
      mixRow('6m+', '6+ months ago', lpCounts['6m+'] ?? 0),
      mixRow('na', 'N/A', lpCounts.na ?? 0),
    ],
    recentPct: pct(lpCounts['3m'] ?? 0, skillsAssessed),
    categories,
  }
}

// Validate a ratings object against a snapshot: every skill answered, values legal.
// Optionally validates last-performed recency for rating_1_4 skills.
export function validateRatings(
  items: SnapshotCategory[],
  ratings: Ratings,
  lastPerformed?: LastPerformed | null,
  requireLastPerformed = false,
): { missing: string[]; invalid: string[]; missingLastPerformed: string[]; invalidLastPerformed: string[] } {
  const missing: string[] = []
  const invalid: string[] = []
  const missingLastPerformed: string[] = []
  const invalidLastPerformed: string[] = []
  const legalLp = new Set(LAST_PERFORMED_OPTIONS.map((o) => o.value as string))
  for (const c of items) {
    for (const s of c.skills) {
      const v = ratings[s.name]
      if (!isAnswered(v)) {
        missing.push(s.name)
        continue
      }
      if (s.questionType === 'rating_1_4') {
        if (!(typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4) && v !== 'na') invalid.push(s.name)
        const lp = lastPerformed?.[s.name]
        if (lp === undefined || lp === null || (lp as string) === '') {
          if (requireLastPerformed) missingLastPerformed.push(s.name)
        } else if (!legalLp.has(lp)) {
          invalidLastPerformed.push(s.name)
        }
      } else if (s.questionType === 'yes_no') {
        if (v !== 'yes' && v !== 'no' && v !== 'na') invalid.push(s.name)
      }
      // text: any non-empty string is fine
    }
  }
  return { missing, invalid, missingLastPerformed, invalidLastPerformed }
}

// Validate additional-question answers against the fixed set.
export function validateAdditional(answers: unknown): { ok: boolean; error?: string } {
  if (answers == null) return { ok: true }
  if (typeof answers !== 'object' || Array.isArray(answers)) return { ok: false, error: 'Invalid additional answers' }
  const legal = new Map(ALL_ADDITIONAL_QUESTIONS.map((q) => [q.id, q.type]))
  for (const [id, v] of Object.entries(answers as Record<string, unknown>)) {
    const type = legal.get(id)
    if (!type) return { ok: false, error: `Unknown additional question "${id}"` }
    if (type === 'yes_no' && v !== 'yes' && v !== 'no') {
      return { ok: false, error: `Additional question "${id}" must be Yes or No` }
    }
    if (type === 'text' && (typeof v !== 'string' || v.length > 2000)) {
      return { ok: false, error: `Additional answer "${id}" is too long` }
    }
  }
  return { ok: true }
}
