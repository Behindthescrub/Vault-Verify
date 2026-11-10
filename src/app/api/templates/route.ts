// GET /api/templates             — all active skill templates grouped by
//                                   profession → jobTitle, with counts.
// GET /api/templates?templateId=x — one template + its skills (for building a checklist).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { SCALE_LEGEND } from '@/lib/skills'

export async function GET(req: NextRequest) {
  const templateId = req.nextUrl.searchParams.get('templateId')

  if (templateId) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const template = await db.skillTemplate.findUnique({
      where: { id: templateId },
      include: { skills: { orderBy: [{ categorySort: 'asc' }, { sortOrder: 'asc' }] } },
    })
    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({
      template: {
        id: template.id,
        profession: template.profession,
        jobTitle: template.jobTitle,
        specialty: template.specialty,
        name: template.name,
      },
      skills: template.skills.map((s) => ({
        skillName: s.skillName,
        category: s.category,
        questionType: s.questionType,
        hasNaOption: s.hasNaOption,
        sortOrder: s.sortOrder,
      })),
    })
  }

  const templates = await db.skillTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ profession: 'asc' }, { jobTitle: 'asc' }, { specialty: 'asc' }],
    include: { skills: { select: { category: true } } },
  })

  const mapped = templates.map((t) => {
    const categories = new Set(t.skills.map((s) => s.category))
    return {
      id: t.id,
      profession: t.profession,
      jobTitle: t.jobTitle,
      specialty: t.specialty,
      name: t.name,
      skillCount: t.skills.length,
      categoryCount: categories.size,
    }
  })

  // grouped: profession → jobTitle → templates[]
  const grouped: Record<string, Record<string, typeof mapped>> = {}
  for (const t of mapped) {
    if (!grouped[t.profession]) grouped[t.profession] = {}
    if (!grouped[t.profession][t.jobTitle]) grouped[t.profession][t.jobTitle] = []
    grouped[t.profession][t.jobTitle].push(t)
  }

  return NextResponse.json({ templates: mapped, grouped, scale: SCALE_LEGEND })
}
