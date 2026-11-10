// Superadmin — validate an .xlsx skills import file (no writes).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { parseSkillsWorkbook } from '@/lib/skills'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.endsWith('.xlsx')) return NextResponse.json({ error: 'Only .xlsx files are accepted' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = parseSkillsWorkbook(buffer)

    // Count duplicates against existing data (case-insensitive per template)
    const rows = result.rows
    const keys = new Set(
      rows.map((r) => `${r.profession}\u0000${r.jobTitle}\u0000${r.specialty}`),
    )
    const templates = await db.skillTemplate.findMany({
      where: {
        OR: [...keys].map((k) => {
          const [profession, jobTitle, specialty] = k.split('\u0000')
          return { profession: { equals: profession }, jobTitle: { equals: jobTitle }, specialty: { equals: specialty } }
        }),
      },
      include: { skills: { select: { category: true, skillName: true } } },
    })
    const existing = new Set<string>()
    for (const t of templates) {
      for (const s of t.skills) existing.add(`${t.id}\u0000${s.category.toLowerCase()}\u0000${s.skillName.toLowerCase()}`)
    }
    const templateIdByKey = new Map<string, string>()
    for (const t of templates) {
      templateIdByKey.set(`${t.profession}\u0000${t.jobTitle}\u0000${t.specialty}`, t.id)
    }
    let duplicates = 0
    const inFile = new Set<string>()
    for (const r of rows) {
      const key = `${r.profession}\u0000${r.jobTitle}\u0000${r.specialty}`
      const tid = templateIdByKey.get(key)
      const dedupe = `${r.category.toLowerCase()}\u0000${r.skillName.toLowerCase()}`
      if ((tid && existing.has(`${tid}\u0000${dedupe}`)) || inFile.has(`${key}\u0000${dedupe}`)) {
        duplicates++
      }
      inFile.add(`${key}\u0000${dedupe}`)
    }

    const newTemplates = [...keys].filter((k) => !templateIdByKey.has(k)).length
    return NextResponse.json({
      totalRows: result.totalRows,
      validRows: result.validRows,
      errorRows: result.errorRows,
      errors: result.errors.slice(0, 100),
      duplicates,
      newTemplates,
      fileName: file.name,
    })
  } catch (e) {
    const msg = e instanceof Error && /Could not find|sheet/i.test(e.message) ? e.message : 'Failed to validate file'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
