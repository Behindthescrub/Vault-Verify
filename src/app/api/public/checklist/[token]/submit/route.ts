import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  computeAvg, validateRatings, validateAdditional, VALIDITY_DAYS,
  type SnapshotCategory, type Ratings, type LastPerformed,
} from '@/lib/skills'

type Params = { params: Promise<{ token: string }> }

const ratingValue = z.union([z.number().int().min(1).max(4), z.literal('na'), z.literal('yes'), z.literal('no'), z.string().trim().min(1).max(2000)])
const lastPerformedValue = z.enum(['3m', '6m', '6m+', 'na'])
const yesNoAnswer = z.enum(['yes', 'no'])
const textAnswer = z.string().trim().max(2000)

const additionalSchema = z.object({
  experienceYears: z.number().min(0).max(60).nullable().optional(),
  answers: z.record(
    z.string(),
    z.union([yesNoAnswer, textAnswer]),
  ).optional(),
})

const schema = z.object({
  ratings: z.record(z.string(), ratingValue),
  lastPerformed: z.record(z.string(), lastPerformedValue).optional(),
  additional: additionalSchema.optional(),
  candidateName: z.string().trim().min(1).max(120),
  candidateEmail: z.string().email().optional(),
  signedName: z.string().trim().min(2).max(120), // typed digital signature
  printedName: z.string().trim().min(2).max(120).optional(), // printed (legal) name
})

// POST /api/public/checklist/[token]/submit — candidate submits their ratings
// in the VaultVerify format: 1–4 ratings + last performed per skill,
// self-reported experience, additional questions and the candidate attestation.
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
    const lastPerformed = (parsed.data.lastPerformed ?? {}) as LastPerformed
    const { missing, invalid, missingLastPerformed, invalidLastPerformed } =
      validateRatings(items, ratings, lastPerformed, true)
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
    if (missingLastPerformed.length > 0) {
      return NextResponse.json(
        { error: `Tell us when you last performed each skill — ${missingLastPerformed.length} missing (e.g. "${missingLastPerformed[0]}")` },
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

    await db.checklistResponse.create({
      data: {
        checklistId: c.id,
        ratingsJson: JSON.stringify(ratings),
        lastPerformedJson: JSON.stringify(lastPerformed),
        additionalJson: JSON.stringify({
          experienceYears: additional?.experienceYears ?? null,
          answers,
        }),
        avgRating: avg,
        signedName: parsed.data.signedName,
        printedName: parsed.data.printedName ?? parsed.data.signedName,
        validUntil,
        completedAt,
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

    return NextResponse.json({ ok: true, avgRating: avg, validUntil })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
