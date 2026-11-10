import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { computeAvg, validateRatings, type SnapshotCategory, type Ratings } from '@/lib/skills'

type Params = { params: Promise<{ token: string }> }

const ratingValue = z.union([z.number().int().min(1).max(4), z.literal('na'), z.literal('yes'), z.literal('no'), z.string().trim().min(1).max(2000)])

const schema = z.object({
  ratings: z.record(z.string(), ratingValue),
  candidateName: z.string().trim().min(1).max(120),
  candidateEmail: z.string().email().optional(),
  signedName: z.string().trim().min(2).max(120), // typed digital signature
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

    const items: SnapshotCategory[] = JSON.parse(c.itemsJson)
    const ratings = parsed.data.ratings as Ratings
    const { missing, invalid } = validateRatings(items, ratings)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Please answer every skill — ${missing.length} missing (e.g. "${missing[0]}")` },
        { status: 400 },
      )
    }
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid answer for "${invalid[0]}" — use 1–4, or N/A where offered` },
        { status: 400 },
      )
    }

    const avg = computeAvg(ratings)

    await db.checklistResponse.create({
      data: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        avgRating: avg,
        signedName: parsed.data.signedName,
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

    return NextResponse.json({ ok: true, avgRating: avg })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
