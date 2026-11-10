import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTemplate } from '@/lib/templates'

type Params = { params: Promise<{ token: string }> }

// GET /api/public/checklist/[token] — public candidate view (no auth).
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const c = await db.checklist.findUnique({
    where: { token },
    include: { response: true },
  })
  if (!c) return NextResponse.json({ error: 'This checklist link is invalid or has been removed.' }, { status: 404 })
  const template = getTemplate(c.templateKey)
  return NextResponse.json({
    checklist: {
      title: c.title,
      templateLabel: template?.label ?? 'Skills Checklist',
      candidateName: c.candidateName,
      alreadySubmitted: !!c.response,
      items: JSON.parse(c.itemsJson),
    },
  })
}
