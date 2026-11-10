import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getTemplate } from '@/lib/templates'

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
    templateKey: c.templateKey,
    candidateName: c.candidateName,
    candidateEmail: c.candidateEmail,
    status: c.status,
    submittedVia: c.submittedVia,
    avgRating: c.response?.avgRating ?? null,
    hasResponse: !!c.response,
    inviteSentAt: c.inviteSentAt,
    createdAt: c.createdAt,
    skillCount: JSON.parse(c.itemsJson).reduce(
      (n: number, i: { skills: string[] }) => n + i.skills.length, 0
    ),
  }))
  return NextResponse.json({ checklists: data })
}

// POST /api/checklists — create from a template (items customizable)
const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  templateKey: z.string().min(1).max(40),
  candidateName: z.string().trim().max(120).optional(),
  candidateEmail: z.string().email().optional(),
  items: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(120),
        skills: z.array(z.string().trim().min(1).max(240)).min(1),
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
    const { title, templateKey, candidateName, candidateEmail, items } = parsed.data

    let itemsJson: string
    if (items) {
      itemsJson = JSON.stringify(items)
    } else {
      const template = getTemplate(templateKey)
      if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      itemsJson = JSON.stringify(template.items)
    }

    const checklist = await db.checklist.create({
      data: {
        userId: user.id,
        title,
        templateKey,
        candidateName: candidateName || null,
        candidateEmail: candidateEmail || null,
        itemsJson,
      },
    })
    return NextResponse.json({ checklist: { id: checklist.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
