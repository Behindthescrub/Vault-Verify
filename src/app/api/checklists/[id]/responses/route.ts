import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  candidateName: z.string().trim().max(120).optional(),
  candidateEmail: z.string().email().optional(),
})

// POST /api/checklists/[id]/responses — recruiter enters the candidate's
// self-reported ratings manually (the "You fill it in" flow).
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const c = await db.checklist.findUnique({ where: { id } })
    if (!c || c.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Validate the submitted ratings cover the checklist skills
    const items: { category: string; skills: string[] }[] = JSON.parse(c.itemsJson)
    const allSkills = items.flatMap((i) => i.skills)
    const ratings = parsed.data.ratings
    const missing = allSkills.filter((s) => !(s in ratings))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Rate every skill — ${missing.length} missing (e.g. "${missing[0]}")` },
        { status: 400 }
      )
    }

    const values = allSkills.map((s) => ratings[s])
    const avg = values.reduce((a, b) => a + b, 0) / values.length

    const response = await db.checklistResponse.upsert({
      where: { checklistId: c.id },
      create: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        avgRating: Math.round(avg * 100) / 100,
      },
      update: {
        ratingsJson: JSON.stringify(ratings),
        avgRating: Math.round(avg * 100) / 100,
        completedAt: new Date(),
      },
    })

    await db.checklist.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedVia: 'manual',
        candidateName: parsed.data.candidateName || c.candidateName,
        candidateEmail: parsed.data.candidateEmail || c.candidateEmail,
      },
    })

    return NextResponse.json({ ok: true, avgRating: response.avgRating })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
