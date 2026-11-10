import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

type Params = { params: Promise<{ token: string }> }

const schema = z.object({
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  candidateName: z.string().trim().min(1).max(120),
  candidateEmail: z.string().email().optional(),
})

// POST /api/public/checklist/[token]/submit — candidate submits their ratings.
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const c = await db.checklist.findUnique({
      where: { token },
      include: { response: true },
    })
    if (!c) return NextResponse.json({ error: 'This checklist link is invalid or has been removed.' }, { status: 404 })
    if (c.response) return NextResponse.json({ error: 'This checklist has already been submitted.' }, { status: 409 })

    const items: { category: string; skills: string[] }[] = JSON.parse(c.itemsJson)
    const allSkills = items.flatMap((i) => i.skills)
    const ratings = parsed.data.ratings
    const missing = allSkills.filter((s) => !(s in ratings))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Please rate every skill — ${missing.length} missing (e.g. "${missing[0]}")` },
        { status: 400 }
      )
    }

    const values = allSkills.map((s) => ratings[s])
    const avg = values.reduce((a, b) => a + b, 0) / values.length

    await db.checklistResponse.create({
      data: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        avgRating: Math.round(avg * 100) / 100,
      },
    })
    await db.checklist.update({
      where: { id: c.id },
      data: {
        status: 'submitted',
        submittedVia: 'link',
        candidateName: parsed.data.candidateName || c.candidateName,
        candidateEmail: parsed.data.candidateEmail || c.candidateEmail,
      },
    })

    return NextResponse.json({ ok: true, avgRating: Math.round(avg * 100) / 100 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
