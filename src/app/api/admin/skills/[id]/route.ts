// Superadmin — update / delete a single skill.
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
  skillName: z.string().trim().min(1).max(240).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  questionType: z.enum(['rating_1_4', 'yes_no', 'text']).optional(),
  hasNaOption: z.boolean().optional(),
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
    const skill = await db.skill.findUnique({ where: { id } })
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    await db.skill.update({ where: { id }, data: parsed.data })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const { id } = await params
  const skill = await db.skill.findUnique({ where: { id } })
  if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  await db.skill.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
