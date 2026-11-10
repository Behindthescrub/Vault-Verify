// Superadmin — update / delete a specialty template.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

async function requireSuperadmin() {
  const user = await getCurrentUser()
  return user && isSuperadmin(user) ? user : null
}

const updateSchema = z.object({
  profession: z.string().trim().min(1).max(80).optional(),
  jobTitle: z.string().trim().min(1).max(120).optional(),
  specialty: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const { id } = await params
    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const template = await db.skillTemplate.findUnique({ where: { id } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    const profession = parsed.data.profession ?? template.profession
    const jobTitle = parsed.data.jobTitle ?? template.jobTitle
    const specialty = parsed.data.specialty ?? template.specialty

    const clash = await db.skillTemplate.findFirst({
      where: { profession: { equals: profession }, jobTitle: { equals: jobTitle }, specialty: { equals: specialty }, id: { not: id } },
    })
    if (clash) return NextResponse.json({ error: 'Another specialty already uses that combination' }, { status: 409 })

    await db.skillTemplate.update({
      where: { id },
      data: {
        ...parsed.data,
        name: `${jobTitle} - ${specialty} Skill Checklist`,
      },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const { id } = await params
  const template = await db.skillTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  // Sent checklists keep their itemsJson snapshot, so deleting a template
  // never breaks existing checklist records.
  await db.skillTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
