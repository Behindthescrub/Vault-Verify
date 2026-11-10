// Superadmin — full read-only detail of any checklist on the platform.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { getTemplate } from '@/lib/templates'

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
  const template = getTemplate(c.templateKey)
  return NextResponse.json({
    checklist: {
      id: c.id,
      title: c.title,
      templateKey: c.templateKey,
      templateLabel: template?.label ?? c.templateKey,
      candidateName: c.candidateName,
      candidateEmail: c.candidateEmail,
      status: c.status,
      submittedVia: c.submittedVia,
      items: JSON.parse(c.itemsJson),
      ratings: c.response ? JSON.parse(c.response.ratingsJson) : null,
      avgRating: c.response?.avgRating ?? null,
      completedAt: c.response?.completedAt ?? null,
      inviteSentAt: c.inviteSentAt,
      createdAt: c.createdAt,
      ownerEmail: c.user.email,
      ownerCompany: c.user.company,
    },
  })
}
