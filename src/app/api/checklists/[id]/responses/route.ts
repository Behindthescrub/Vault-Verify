import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { computeAvg, validateRatings, type SnapshotCategory, type Ratings } from '@/lib/skills'

type Params = { params: Promise<{ id: string }> }

const ratingValue = z.union([z.number().int().min(1).max(4), z.literal('na'), z.literal('yes'), z.literal('no'), z.string().trim().min(1).max(2000)])

const schema = z.object({
  ratings: z.record(z.string(), ratingValue),
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

    const items: SnapshotCategory[] = JSON.parse(c.itemsJson)
    const ratings = parsed.data.ratings as Ratings
    const { missing, invalid } = validateRatings(items, ratings)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Rate every skill — ${missing.length} missing (e.g. "${missing[0]}")` },
        { status: 400 },
      )
    }
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid rating for "${invalid[0]}" — use 1–4, or N/A where offered` },
        { status: 400 },
      )
    }

    const avg = computeAvg(ratings)
    const response = await db.checklistResponse.upsert({
      where: { checklistId: c.id },
      create: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        avgRating: avg,
      },
      update: {
        ratingsJson: JSON.stringify(ratings),
        avgRating: avg,
        completedAt: new Date(),
      },
    })
    await db.checklist.update({
      where: { id: c.id },
      data: {
        status: 'submitted',
        submittedVia: 'manual',
        candidateName: parsed.data.candidateName || c.candidateName,
        candidateEmail: parsed.data.candidateEmail || c.candidateEmail,
      },
    })

    return NextResponse.json({ ok: true, avgRating: avg, responseId: response.id })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
