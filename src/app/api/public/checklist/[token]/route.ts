import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SCALE_LEGEND, type SnapshotCategory } from '@/lib/skills'

type Params = { params: Promise<{ token: string }> }

// GET /api/public/checklist/[token] — public candidate view (no auth).
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const c = await db.checklist.findUnique({
    where: { token },
    include: { response: true },
  })
  if (!c) return NextResponse.json({ error: 'This checklist link is invalid or has been removed.' }, { status: 404 })
  return NextResponse.json({
    checklist: {
      title: c.title,
      templateLabel: c.templateLabel,
      candidateName: c.candidateName,
      alreadySubmitted: !!c.response,
      items: JSON.parse(c.itemsJson) as SnapshotCategory[],
      scale: SCALE_LEGEND,
    },
  })
}
