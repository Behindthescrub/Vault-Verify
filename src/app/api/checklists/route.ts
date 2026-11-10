import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { buildTemplateSnapshot, templateLabel, type SnapshotCategory } from '@/lib/skills'

// GET /api/checklists — list current user's checklists with response summary
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const rows = await db.checklist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { response: true },
  })
  const data = rows.map((c) => ({
    id: c.id,
    title: c.title,
    templateLabel: c.templateLabel,
    candidateName: c.candidateName,
    candidateEmail: c.candidateEmail,
    status: c.status,
    submittedVia: c.submittedVia,
    avgRating: c.response?.avgRating ?? null,
    hasResponse: !!c.response,
    inviteSentAt: c.inviteSentAt,
    createdAt: c.createdAt,
    skillCount: JSON.parse(c.itemsJson).reduce(
      (n: number, i: { skills: unknown[] }) => n + i.skills.length, 0
    ),
  }))
  return NextResponse.json({ checklists: data })
}

// POST /api/checklists — create from a template (skills customizable)
const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  templateId: z.string().min(1).max(40),
  candidateName: z.string().trim().max(120).optional(),
  candidateEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(120),
        skills: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(240),
              questionType: z.enum(['rating_1_4', 'yes_no', 'text']).default('rating_1_4'),
              hasNaOption: z.boolean().default(false),
            })
          )
          .min(1),
      })
    )
    .min(1)
    .optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { title, templateId, candidateName, candidateEmail, items } = parsed.data

    const snapshot = await buildTemplateSnapshot(templateId)
    if (!snapshot) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })

    const itemsJson: SnapshotCategory[] =
      items ?? snapshot.items

    const checklist = await db.checklist.create({
      data: {
        userId: user.id,
        title,
        templateId: snapshot.template.id,
        templateLabel: templateLabel(snapshot.template.profession, snapshot.template.jobTitle, snapshot.template.specialty),
        candidateName: candidateName || null,
        candidateEmail: candidateEmail || null,
        itemsJson: JSON.stringify(itemsJson),
      },
    })
    return NextResponse.json({ checklist: { id: checklist.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
