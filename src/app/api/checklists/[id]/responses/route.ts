import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import {
  computeAvg, validateRatings, validateAdditional, VALIDITY_DAYS,
  type SnapshotCategory, type Ratings, type LastPerformed,
} from '@/lib/skills'

type Params = { params: Promise<{ id: string }> }

const ratingValue = z.union([z.number().int().min(1).max(4), z.literal('na'), z.literal('yes'), z.literal('no'), z.string().trim().min(1).max(2000)])
const lastPerformedValue = z.enum(['3m', '6m', '6m+', 'na'])
const additionalSchema = z.object({
  experienceYears: z.number().min(0).max(60).nullable().optional(),
  answers: z.record(z.string(), z.union([z.enum(['yes', 'no']), z.string().trim().max(2000)])).optional(),
})

const schema = z.object({
  ratings: z.record(z.string(), ratingValue),
  lastPerformed: z.record(z.string(), lastPerformedValue).optional(),
  additional: additionalSchema.optional(),
  candidateName: z.string().trim().max(120).optional(),
  candidateEmail: z.string().email().optional(),
})

// POST /api/checklists/[id]/responses — recruiter enters the candidate's
// self-reported ratings manually (the "You fill it in" flow). Last performed,
// experience and additional questions are optional here.
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
    const lastPerformed = (parsed.data.lastPerformed ?? {}) as LastPerformed
    const { missing, invalid, invalidLastPerformed } = validateRatings(items, ratings, lastPerformed, false)
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
    if (invalidLastPerformed.length > 0) {
      return NextResponse.json(
        { error: `Invalid "last performed" for "${invalidLastPerformed[0]}"` },
        { status: 400 },
      )
    }

    const additional = parsed.data.additional
    const answers = additional?.answers ?? {}
    const additionalCheck = validateAdditional(answers)
    if (!additionalCheck.ok) {
      return NextResponse.json({ error: additionalCheck.error ?? 'Invalid additional answers' }, { status: 400 })
    }

    const avg = computeAvg(ratings)
    const completedAt = new Date()
    const validUntil = new Date(completedAt.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000)

    const response = await db.checklistResponse.upsert({
      where: { checklistId: c.id },
      create: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        lastPerformedJson: JSON.stringify(lastPerformed),
        additionalJson: JSON.stringify({ experienceYears: additional?.experienceYears ?? null, answers }),
        avgRating: avg,
        validUntil,
        completedAt,
      },
      update: {
        ratingsJson: JSON.stringify(ratings),
        lastPerformedJson: JSON.stringify(lastPerformed),
        additionalJson: JSON.stringify({ experienceYears: additional?.experienceYears ?? null, answers }),
        avgRating: avg,
        validUntil,
        completedAt,
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
