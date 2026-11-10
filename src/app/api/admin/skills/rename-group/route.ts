// Superadmin — bulk-rename a profession or job title across all templates.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const schema = z.object({
      field: z.enum(['profession', 'jobTitle']),
      from: z.string().trim().min(1).max(120),
      to: z.string().trim().min(1).max(120),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { field, from, to } = parsed.data
    if (from === to) return NextResponse.json({ error: 'New name is the same as the old one' }, { status: 400 })

    const where = field === 'profession' ? { profession: { equals: from } } : { jobTitle: { equals: from } }
    const templates = await db.skillTemplate.findMany({ where })

    // Detect clashes: renaming would merge into an existing (profession, jobTitle, specialty)
    for (const t of templates) {
      const profession = field === 'profession' ? to : t.profession
      const jobTitle = field === 'jobTitle' ? to : t.jobTitle
      const clash = await db.skillTemplate.findFirst({
        where: { profession: { equals: profession }, jobTitle: { equals: jobTitle }, specialty: { equals: t.specialty }, id: { not: t.id } },
      })
      if (clash) {
        return NextResponse.json(
          { error: `Renaming would clash with an existing template (${profession} | ${jobTitle} | ${t.specialty})` },
          { status: 409 },
        )
      }
    }

    const result = await db.skillTemplate.updateMany({
      where,
      data: field === 'profession' ? { profession: to } : { jobTitle: to },
    })
    // Refresh template display names
    const updated = await db.skillTemplate.findMany({
      where: field === 'profession' ? { profession: { equals: to } } : { jobTitle: { equals: to } },
    })
    for (const t of updated) {
      await db.skillTemplate.update({
        where: { id: t.id },
        data: { name: `${t.jobTitle} - ${t.specialty} Skill Checklist` },
      })
    }
    return NextResponse.json({ ok: true, updated: result.count })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
