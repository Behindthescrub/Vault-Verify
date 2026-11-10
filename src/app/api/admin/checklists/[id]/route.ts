// Superadmin — full read-only detail of any checklist on the platform.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { serializeChecklistDetail } from '@/lib/skills'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }
  const { id } = await params
  const c = await db.checklist.findUnique({
    where: { id },
    include: { response: true, user: { select: { email: true, company: true } } },
  })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    checklist: {
      ...serializeChecklistDetail(c),
      ownerEmail: c.user.email,
      ownerCompany: c.user.company,
    },
  })
}
