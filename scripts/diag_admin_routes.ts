// One-shot diagnostic: run the EXACT queries from /api/admin/skills and
// /api/admin/users against the Supabase DB, with timings + payload sizes,
// plus table counts. Tells us whether the routes error at the DB level or
// whether it's a Vercel-environment issue (timeout / connections).
// Run: DATABASE_URL="$(from .env)" bun scripts/diag_admin_routes.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const t = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
  const start = Date.now()
  try {
    const r = await fn()
    const ms = Date.now() - start
    const size = JSON.stringify(r)?.length ?? 0
    console.log(`OK   ${label}: ${ms}ms, payload ${size} bytes`)
    return r
  } catch (e) {
    console.log(`FAIL ${label}: ${(e as Error).message.slice(0, 300)}`)
    return null
  }
}

console.log('== /api/admin/skills queries ==')
const templates = await t('skillTemplate.findMany(+_count)', () =>
  db.skillTemplate.findMany({
    orderBy: [{ profession: 'asc' }, { jobTitle: 'asc' }, { specialty: 'asc' }],
    include: { _count: { select: { skills: true } } },
  }))
await t('skill.findMany(templateId,category) — 33k rows', () =>
  db.skill.findMany({ select: { templateId: true, category: true } }))

if (templates) {
  const skillAgg = await db.skill.findMany({ select: { templateId: true, category: true } }).catch(() => [])
  const catsByTemplate = new Map<string, Set<string>>()
  for (const s of skillAgg) {
    if (!catsByTemplate.has(s.templateId)) catsByTemplate.set(s.templateId, new Set())
    catsByTemplate.get(s.templateId)!.add(s.category)
  }
  const payload = JSON.stringify({
    templates: templates.map((x) => ({ id: x.id, skillCount: x._count.skills, categoryCount: catsByTemplate.get(x.id)?.size ?? 0 })),
    totals: { templates: templates.length, skills: skillAgg.length, professions: new Set(templates.map((x) => x.profession)).size },
  })
  console.log(`     full skills-route response payload: ${payload.length} bytes`)
}

console.log('== /api/admin/users queries ==')
await t('user.findMany(+3 counts)', () =>
  db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { checklists: true, calculations: true, sessions: true } } },
  }))
await t('session.findMany(active)', () =>
  db.session.findMany({ where: { expiresAt: { gt: new Date() } }, select: { userId: true } }))

console.log('== table counts ==')
for (const [name, q] of [
  ['SkillTemplate', db.skillTemplate.count()],
  ['Skill', db.skill.count()],
  ['User', db.user.count()],
  ['Session', db.session.count()],
  ['Checklist', db.checklist.count()],
] as const) {
  console.log(`     ${name}: ${await q}`)
}

await db.$disconnect()
