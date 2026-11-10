// Shared skills-checklist library — the MyZipVault/VaultVerify data model:
// Profession → Job Title → Specialty → Category → Skill (1–4 rating + N/A),
// per-skill "Last performed" recency, additional questions and candidate attestation.
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

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

// ─── Build the immutable skills snapshot for a template ─────────────
export async function buildTemplateSnapshot(templateId: string): Promise<{
  template: { id: string; profession: string; jobTitle: string; specialty: string; name: string }
  items: SnapshotCategory[]
} | null> {
  const t = await db.skillTemplate.findUnique({
    where: { id: templateId },
    include: { skills: { orderBy: [{ categorySort: 'asc' }, { sortOrder: 'asc' }] } },
  })
  if (!t) return null
  const byCat = new Map<string, SnapshotSkill[]>()
  for (const s of t.skills) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category)!.push({
      name: s.skillName,
      questionType: s.questionType,
      hasNaOption: s.hasNaOption,
    })
  }
  return {
    template: { id: t.id, profession: t.profession, jobTitle: t.jobTitle, specialty: t.specialty, name: t.name },
    items: [...byCat.entries()].map(([category, skills]) => ({ category, skills })),
  }
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

// ─── xlsx import (MyZipVault "Skills Data" template) ────────────────
export type ParsedSkillRow = {
  profession: string
  jobTitle: string
  specialty: string
  category: string
  skillName: string
  questionType: string
  hasNaOption: boolean
}

export type ParseResult = {
  totalRows: number
  validRows: number
  errorRows: number
  errors: { row: number; message: string }[]
  rows: ParsedSkillRow[]
}

export const SKILLS_SHEET_HEADERS = [
  'Profession', 'Job Title', 'Specialty', 'Category', 'Skill Name', 'Question Type', 'Has N/A Option',
]

export function parseSkillsWorkbook(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const wsName = wb.SheetNames.includes('Skills Data') ? 'Skills Data' : wb.SheetNames[0]
  const ws = wb.Sheets[wsName]
  if (!ws) throw new Error('Could not find a "Skills Data" sheet')

  const raw: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const rows: ParsedSkillRow[] = []
  const errors: { row: number; message: string }[] = []
  let valid = 0

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === '')) continue

    const profession = String(row[0] ?? '').trim()
    const jobTitle = String(row[1] ?? '').trim()
    const specialty = String(row[2] ?? '').trim()
    const category = String(row[3] ?? '').trim()
    const skillName = String(row[4] ?? '').trim()
    const questionTypeRaw = String(row[5] ?? '').trim()
    const hasNaRaw = String(row[6] ?? '').trim()

    if (!profession || !jobTitle || !specialty || !category || !skillName) {
      errors.push({ row: i + 1, message: 'Missing required field(s): Profession, Job Title, Specialty, Category and Skill Name are all required' })
      continue
    }
    const questionType = (VALID_QUESTION_TYPES as readonly string[]).includes(questionTypeRaw) ? questionTypeRaw : 'rating_1_4'
    rows.push({ profession, jobTitle, specialty, category, skillName, questionType, hasNaOption: hasNaRaw.toLowerCase() === 'yes' })
    valid++
  }

  return { totalRows: raw.length - 1, validRows: valid, errorRows: errors.length, errors, rows }
}

// ─── xlsx export helpers ────────────────────────────────────────────
export function buildSkillsTemplateXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([SKILLS_SHEET_HEADERS])
  ws['!cols'] = [{ wch: 15 }, { wch: 24 }, { wch: 28 }, { wch: 32 }, { wch: 52 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Skills Data')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildSkillsDataXlsx(): Promise<Buffer> {
  return (async () => {
    const templates = await db.skillTemplate.findMany({
      orderBy: [{ profession: 'asc' }, { jobTitle: 'asc' }, { specialty: 'asc' }],
      include: { skills: { orderBy: [{ categorySort: 'asc' }, { sortOrder: 'asc' }] } },
    })
    const aoa: (string | number | boolean)[][] = [SKILLS_SHEET_HEADERS]
    for (const t of templates) {
      for (const s of t.skills) {
        aoa.push([
          t.profession, t.jobTitle, t.specialty,
          s.category, s.skillName, s.questionType, s.hasNaOption ? 'Yes' : 'No',
        ])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 15 }, { wch: 24 }, { wch: 28 }, { wch: 32 }, { wch: 52 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Skills Data')
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  })()
}

// ─── Serialize a checklist + response for detail views ───────────────
// Shared by the recruiter detail API and the superadmin read-only API.
import type { Checklist, ChecklistResponse } from '@prisma/client'

export type SerializedChecklistDetail = {
  id: string
  title: string
  templateLabel: string
  candidateName: string | null
  candidateEmail: string | null
  status: string
  submittedVia: string | null
  token: string
  items: SnapshotCategory[]
  ratings: Ratings | null
  lastPerformed: LastPerformed | null
  additional: AdditionalData | null
  avgRating: number | null
  signedName: string | null
  printedName: string | null
  validUntil: string | null
  completedAt: string | null
  inviteSentAt: string | null
  createdAt: string
}

export function serializeChecklistDetail(
  c: Checklist & { response: ChecklistResponse | null },
): SerializedChecklistDetail {
  let additional: AdditionalData | null = null
  if (c.response?.additionalJson) {
    try {
      const raw = JSON.parse(c.response.additionalJson) as { experienceYears?: number | null; answers?: AdditionalAnswers }
      additional = { experienceYears: raw.experienceYears ?? null, answers: raw.answers ?? {} }
    } catch { /* corrupt json — treat as absent */ }
  }
  let lastPerformed: LastPerformed | null = null
  if (c.response?.lastPerformedJson) {
    try { lastPerformed = JSON.parse(c.response.lastPerformedJson) } catch { /* treat as absent */ }
  }
  // Legacy responses (pre-VaultVerify fields) still get a 30-day window from completion.
  const validUntil =
    c.response?.validUntil ??
    (c.response ? new Date(c.response.completedAt.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000) : null)
  return {
    id: c.id,
    title: c.title,
    templateLabel: c.templateLabel,
    candidateName: c.candidateName,
    candidateEmail: c.candidateEmail,
    status: c.status,
    submittedVia: c.submittedVia,
    token: c.token,
    items: JSON.parse(c.itemsJson) as SnapshotCategory[],
    ratings: c.response ? (JSON.parse(c.response.ratingsJson) as Ratings) : null,
    lastPerformed,
    additional,
    avgRating: c.response?.avgRating ?? null,
    signedName: c.response?.signedName ?? null,
    printedName: c.response?.printedName ?? null,
    validUntil: validUntil ? validUntil.toISOString() : null,
    completedAt: c.response?.completedAt?.toISOString() ?? null,
    inviteSentAt: c.inviteSentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }
}
