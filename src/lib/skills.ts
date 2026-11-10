// Shared skills-checklist library — the MyZipVault data model:
// Profession → Job Title → Specialty → Category → Skill (1–4 rating + N/A).
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

// ─── Rating scale (MyZipVault proficiency scale, 1–4) ───────────────
export const SCALE_MAX = 4
export const SCALE_LEGEND: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'No experience — have not performed this skill', short: 'No Experience' },
  { value: 2, label: 'Limited — performed only with direct oversight', short: 'Limited' },
  { value: 3, label: 'Experienced — independent with occasional guidance', short: 'Experienced' },
  { value: 4, label: 'Proficient — fully independent, can handle complex cases', short: 'Proficient' },
]

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
    include: { skills: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] } },
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

// Validate a ratings object against a snapshot: every skill answered, values legal.
export function validateRatings(items: SnapshotCategory[], ratings: Ratings): { missing: string[]; invalid: string[] } {
  const missing: string[] = []
  const invalid: string[] = []
  for (const c of items) {
    for (const s of c.skills) {
      const v = ratings[s.name]
      if (!isAnswered(v)) {
        missing.push(s.name)
        continue
      }
      if (s.questionType === 'rating_1_4') {
        if (!(typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4) && v !== 'na') invalid.push(s.name)
      } else if (s.questionType === 'yes_no') {
        if (v !== 'yes' && v !== 'no' && v !== 'na') invalid.push(s.name)
      }
      // text: any non-empty string is fine
    }
  }
  return { missing, invalid }
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
      include: { skills: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] } },
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
