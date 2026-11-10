// Superadmin — import skills data from the MyZipVault "Skills Data" xlsx template.
// Templates are keyed by (profession, jobTitle, specialty); duplicate skills are skipped.
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
    const rows = result.rows

    let imported = 0
    let skipped = 0

    // Group by (profession, jobTitle, specialty) → one template pass per group
    const groups = new Map<string, typeof rows>()
    for (const r of rows) {
      const key = `${r.profession}\u0000${r.jobTitle}\u0000${r.specialty}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    for (const [key, grows] of groups) {
      const [profession, jobTitle, specialty] = key.split('\u0000')
      let template = await db.skillTemplate.findFirst({
        where: { profession: { equals: profession }, jobTitle: { equals: jobTitle }, specialty: { equals: specialty } },
      })
      if (!template) {
        template = await db.skillTemplate.create({
          data: { profession, jobTitle, specialty, name: `${jobTitle} - ${specialty} Skill Checklist`, sortOrder: 0 },
        })
      }

      const existing = await db.skill.findMany({
        where: { templateId: template.id },
        select: { category: true, skillName: true },
      })
      const seen = new Set(existing.map((s) => `${s.category.toLowerCase()}\u0000${s.skillName.toLowerCase()}`))
      const existingCats = await db.skill.findMany({
        where: { templateId: template.id },
        select: { category: true, categorySort: true },
        distinct: ['category'],
      })
      const catSort = new Map(existingCats.map((s) => [s.category, s.categorySort]))
      let nextCat = existingCats.reduce((m, s) => Math.max(m, s.categorySort), -1) + 1

      const order = new Map<string, number>()
      const toCreate: { templateId: string; skillName: string; category: string; questionType: string; sortOrder: number; categorySort: number; hasNaOption: boolean }[] = []
      for (const r of grows) {
        const dedupe = `${r.category.toLowerCase()}\u0000${r.skillName.toLowerCase()}`
        if (seen.has(dedupe)) {
          skipped++
          continue
        }
        seen.add(dedupe)
        if (!catSort.has(r.category)) catSort.set(r.category, nextCat++) // natural xlsx order for new categories
        const so = (order.get(r.category) ?? -1) + 1
        order.set(r.category, so)
        toCreate.push({
          templateId: template.id,
          skillName: r.skillName,
          category: r.category,
          questionType: r.questionType,
          sortOrder: so,
          categorySort: catSort.get(r.category)!,
          hasNaOption: r.hasNaOption,
        })
      }
      for (let i = 0; i < toCreate.length; i += 500) {
        await db.skill.createMany({ data: toCreate.slice(i, i + 500) })
      }
      imported += toCreate.length
    }

    return NextResponse.json({ imported, skipped, errorRows: result.errorRows })
  } catch {
    return NextResponse.json({ error: 'Failed to import skills data' }, { status: 500 })
  }
}
