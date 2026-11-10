// Admin console — skills data management.
// GET    /api/admin/skills               → all templates (with counts)
// GET    /api/admin/skills?templateId=x  → one template + its skills
// POST   /api/admin/skills               → add a skill to a template
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

async function requireSuperadmin() {
  const user = await getCurrentUser()
  return user && isSuperadmin(user) ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })

  const templateId = req.nextUrl.searchParams.get('templateId')

  try {
    if (templateId) {
      const template = await db.skillTemplate.findUnique({
        where: { id: templateId },
        include: { skills: { orderBy: [{ categorySort: 'asc' }, { sortOrder: 'asc' }] } },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      return NextResponse.json({
        template: {
          id: template.id,
          profession: template.profession,
          jobTitle: template.jobTitle,
          specialty: template.specialty,
          name: template.name,
          isActive: template.isActive,
          skillCount: template.skills.length,
        },
        skills: template.skills.map((s) => ({
          id: s.id,
          skillName: s.skillName,
          category: s.category,
          questionType: s.questionType,
          sortOrder: s.sortOrder,
          hasNaOption: s.hasNaOption,
        })),
      })
    }

    // All templates with skill/category counts. The category/skill counts come
    // from a single GROUP BY (315 rows) instead of fetching every skill row —
    // one-third the latency on a hosted database, same output.
    const [templates, catAgg] = await Promise.all([
      db.skillTemplate.findMany({
        orderBy: [{ profession: 'asc' }, { jobTitle: 'asc' }, { specialty: 'asc' }],
        include: { _count: { select: { skills: true } } },
      }),
      db.$queryRaw<Array<{ templateId: string; cats: number; skills: number }>>`
        SELECT "templateId",
               COUNT(DISTINCT "category")::int AS cats,
               COUNT(*)::int AS skills
        FROM "Skill" GROUP BY "templateId"`,
    ])
    const aggByTemplate = new Map(catAgg.map((r) => [r.templateId, r]))
    let totalSkills = 0
    for (const r of catAgg) totalSkills += r.skills
    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        profession: t.profession,
        jobTitle: t.jobTitle,
        specialty: t.specialty,
        name: t.name,
        isActive: t.isActive,
        skillCount: t._count.skills,
        categoryCount: aggByTemplate.get(t.id)?.cats ?? 0,
      })),
      totals: {
        templates: templates.length,
        skills: totalSkills,
        professions: new Set(templates.map((t) => t.profession)).size,
      },
    })
  } catch (e) {
    console.error('[api/admin/skills] GET failed:', e)
    return NextResponse.json({ error: 'Failed to load skills data' }, { status: 500 })
  }
}

const addSkillSchema = z.object({
  templateId: z.string().min(1),
  skillName: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(120),
  questionType: z.enum(['rating_1_4', 'yes_no', 'text']).default('rating_1_4'),
  hasNaOption: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const parsed = addSkillSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { templateId, skillName, category, questionType, hasNaOption } = parsed.data
    const template = await db.skillTemplate.findUnique({ where: { id: templateId } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const dup = await db.skill.findFirst({
      where: { templateId, category: { equals: category }, skillName: { equals: skillName } },
    })
    if (dup) return NextResponse.json({ error: 'This skill already exists in that category' }, { status: 409 })

    const maxSort = await db.skill.findFirst({
      where: { templateId, category: { equals: category } },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    // keep the category's existing position, or append it as a new category
    const catRow = await db.skill.findFirst({
      where: { templateId, category: { equals: category } },
      select: { categorySort: true },
    })
    let categorySort = catRow?.categorySort
    if (categorySort == null) {
      const maxCat = await db.skill.findFirst({
        where: { templateId },
        orderBy: { categorySort: 'desc' },
        select: { categorySort: true },
      })
      categorySort = (maxCat?.categorySort ?? -1) + 1
    }
    const skill = await db.skill.create({
      data: { templateId, skillName, category, questionType, hasNaOption, sortOrder: (maxSort?.sortOrder ?? -1) + 1, categorySort },
    })
    return NextResponse.json({ skill: { id: skill.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
