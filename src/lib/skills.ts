// Skills-checklist server library — re-exports the shared pure definitions
// and adds everything that touches the database or the filesystem
// (template snapshots, xlsx import/export, checklist serialization).
// Server-side only: never import this module from a client component.
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import type { Checklist, ChecklistResponse } from '@prisma/client'
import {
  VALIDITY_DAYS, VALID_QUESTION_TYPES,
  type AdditionalAnswers, type AdditionalData, type LastPerformed, type Ratings,
  type SnapshotCategory, type SnapshotSkill,
} from '@/lib/skills-shared'

export * from '@/lib/skills-shared'

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

// ─── xlsx import ("Skills Data" template) ────────────────
// ─── xlsx import ("Skills Data" template) ────────────────
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
// Shared by the recruiter detail API and the admin read-only API.
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
