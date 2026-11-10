// Superadmin — delete ALL skills data (destructive, requires typed confirmation).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const schema = z.object({ confirm: z.literal('DELETE') })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 })
    }
    // Sent checklists keep their itemsJson snapshot and stay intact.
    await db.skill.deleteMany({})
    await db.skillTemplate.deleteMany({})
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
