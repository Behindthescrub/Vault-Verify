// Superadmin — every checklist on the platform (all recruiter accounts).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const status = sp.get('status') // all | draft | sent | submitted

  const where: { status?: string } = {}
  if (status && status !== 'all') where.status = status

  const rows = await db.checklist.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { email: true, company: true } },
      response: { select: { avgRating: true, completedAt: true } },
    },
    take: 500,
  })

  return NextResponse.json({
    checklists: rows.map((c) => {
      const items = JSON.parse(c.itemsJson) as { category: string; skills: unknown[] }[]
      return {
        id: c.id,
        title: c.title,
        templateLabel: c.templateLabel,
        candidateName: c.candidateName,
        candidateEmail: c.candidateEmail,
        status: c.status,
        submittedVia: c.submittedVia,
        avgRating: c.response?.avgRating ?? null,
        completedAt: c.response?.completedAt ?? null,
        skillCount: items.reduce((n, cat) => n + cat.skills.length, 0),
        ownerEmail: c.user.email,
        ownerCompany: c.user.company,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }
    }),
  })
}
