// Superadmin — delete a whole profession or job title group (all templates under it).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const schema = z.object({
      field: z.enum(['profession', 'jobTitle']),
      value: z.string().trim().min(1).max(120),
      confirm: z.literal(true),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }
    const { field, value } = parsed.data
    const where = field === 'profession' ? { profession: { equals: value } } : { jobTitle: { equals: value } }
    const count = await db.skillTemplate.count({ where })
    if (count === 0) return NextResponse.json({ error: 'Nothing to delete' }, { status: 404 })
    await db.skillTemplate.deleteMany({ where }) // skills cascade
    return NextResponse.json({ ok: true, deletedTemplates: count })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
