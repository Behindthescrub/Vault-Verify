import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { SCALE_MAX } from '@/lib/skills'
import type { SnapshotCategory } from '@/lib/skills'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const c = await db.checklist.findUnique({ where: { id }, include: { response: true } })
  if (!c || c.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    checklist: {
      id: c.id,
      title: c.title,
      templateLabel: c.templateLabel,
      candidateName: c.candidateName,
      candidateEmail: c.candidateEmail,
      status: c.status,
      submittedVia: c.submittedVia,
      token: c.token,
      items: JSON.parse(c.itemsJson) as SnapshotCategory[],
      ratings: c.response ? JSON.parse(c.response.ratingsJson) : null,
      avgRating: c.response?.avgRating ?? null,
      signedName: c.response?.signedName ?? null,
      completedAt: c.response?.completedAt ?? null,
      inviteSentAt: c.inviteSentAt,
      createdAt: c.createdAt,
      scaleMax: SCALE_MAX,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const c = await db.checklist.findUnique({ where: { id } })
  if (!c || c.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.checklist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
